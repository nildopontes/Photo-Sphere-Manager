var db, map, markers = [], lines = [];
function initMap(){
   map = new google.maps.Map(document.getElementById('workspace'), { // Remover o arquivo DB para efetuar os testes das ultimas modificações
      center: { lat: -9.598392783313042, lng: -35.73571500947498 }, // Antes de fechar ou sair da página devo capturar o center e o zoom do mapa, atualizar no projeto e sincronizar no DB
      zoom: 12,
      mapId: "project",
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: true,
   });
   map.addListener('contextmenu', e => {
      if(window.confirm('Quer adicionar uma foto nesta localização?')){
         showForm(e.latLng.lat(), e.latLng.lng());
      }
   });
}
function sha1(message){
   return new Promise((resolve, reject) => {
      let msgUint8 = new TextEncoder().encode(message);
      window.crypto.subtle.digest('SHA-256', msgUint8).then(hashBuffer => {
         let hashArray = Array.from(new Uint8Array(hashBuffer));
         resolve(hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
      });
   });
}
function addMarker(lat, lng, id, name){
   let marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: lat, lng: lng },
      title: name
   });
   marker.data = id;
   markers.push(marker);
   marker.setMap(map);
}
function removeMarker(data){
   markers.map((x, i) => {
      if(markers[i].data == data){
         markers[i].map = null;
         markers.splice(i, 1);
      }
   });
}
function renameMarker(data, newName){
   markers.map((x, i) => {
      if(markers[i].data == data){
         markers[i].title = newName;
      }
   });
}
function addLine(lat, lng, id1, id2){
   let found = false;
   lines.map((x, i) => {
      let ids = JSON.parse(lines[i].data).ids;
      if(ids.includes(id1) && ids.includes(id2)){
         let newCoord = lines[i].getPath().getArray();
         newCoord.push({lat: lat, lng: lng});
         lines[i].setPath(newCoord);
         found = true;
      }
   });
   if(found) return;
   let coords = [
      {lat: lat, lng: lng}
   ];
   let line = new google.maps.Polyline({
      path: coords,
      geodesic: true,
      strokeColor: '#6495ED',
      strokeOpacity: 1.0,
      strokeWeight: 8
   });
   line.data = JSON.stringify({"ids": [id1, id2]});
   lines.push(line);
   line.setMap(map);
}
function removeLine(id1, id2){
   lines.map((x, i) => {
      let ids = JSON.parse(lines[i].data).ids;
      if(ids.includes(id1) && ids.includes(id2)){
         lines[i].setMap(null);
         lines.splice(i, 1);
      }
   });
}
function showLoading(){
   document.getElementById('loading').style.display = 'block';
}
function hideLoading(){
   document.getElementById('loading').style.display = 'none';
}
function showForm(lat, lng){
   document.getElementById('formUpload').style.display = 'block';
   document.getElementById('lat').value = lat;
   document.getElementById('lng').value = lng;
}
function hideForm(){
   document.getElementById('formUpload').style.display = 'none';
   document.getElementById('name').value = '';
   document.getElementById('photo').value = '';
   document.getElementById('lat').value = '';
   document.getElementById('lng').value = '';
}
function submit(){
   if(document.getElementById('photo').value.length == 0 || document.getElementById('name').value.length == 0){
      alert('Preencha todos os campos.');
   }else{
      showLoading();
      getToken().then(t => {
         getUploadURL(t).then(uploadUrl => {
            sendImageData(t, 'photo', uploadUrl).then(() => {
               sendMetadata(t, uploadUrl, document.getElementById('lat').value, document.getElementById('lng').value).then(r => {
                  addPhoto(project, r.photoId.id, parseFloat(document.getElementById('lat').value), parseFloat(document.getElementById('lng').value), document.getElementById('name').value);
                  updateFile(t, JSON.stringify(db), db.idOnDrive);
                  hideForm();
                  hideLoading();
               });
            });
         });
      });
   }
}
function addPhoto(projectName, idPhoto, lat, lng, photoName){
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == projectName){
         db.projects[i].photos.push({
            "photoId": idPhoto,
            "name": photoName,
            "latLng": [lat, lng],
            "connections": []
         });
         addMarker(lat, lng, idPhoto, photoName);
         found ++;
         getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
         alert('Foto adicionada com sucesso.');
      }
   });
   if(found == 0) alert('Erro. O projeto não existe.');
}
function goToProject (name){
   sha1(name).then(r => window.location.href = `project.html?hash=${r}`);
}
function listProjects(){
   let projects = '';
   db.projects.map(x => {
      projects += `<div class="project"><div class="name" onclick="goToProject('${x.name}')">${x.name}</div><div class="btns"><span class="edit" onclick="renameProject('${x.name}')">✎</span>&nbsp;&nbsp;&nbsp;<span class="trash" onclick="removeProject('${x.name}')">✖</span></div></div>`;
   });
   document.getElementById('projects').innerHTML = projects;
   
}
function addProject(){
   let name = prompt('Escolha um nome para o projeto.');
   if(name === null || name.length == 0){
      alert('O nome precisa ter pelo menos 1 caractere.');
      return;
   }
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == name) found++;
   });
   if(found > 0){
      alert('Este projeto já existe.');
   }else{
      db.projects.push({
         "name": name,
         "photos": [],
         "zoom": 12,
         "center": {
            lat: -9.598392783313042,
            lng: -35.73571500947498
         }
      });
      getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
      listProjects();
      alert('Projeto criado com sucesso.');
   }
}
function removePhoto(photoId, projectName){
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == projectName){
         db.projects[i].photos.map((y, j) => {
            if(db.projects[i].photos[j].photoId == photoId){
               found++;
               getToken().then(t => {
                  deletePhoto(t, photoId).then(r => {
                     if(r === true){
                        db.projects[i].photos[j].splice(j, 1);
                        updateFile(t, JSON.stringify(db), db.idOnDrive);
                        alert('Foto removida com sucesso.');
                     }
                  }).catch(e => alert(`A foto foi encontrada mas ocorreu um erro ao tentar apagar. ${e}`));
               });
            }
         });
      }
   });
   if(found == 0) alert('A foto não foi encontrada. Verifique se o ID da foto e nome do projeto estão corretos.');
}
function renamePhoto(photoId, newName, projectName){
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == projectName){
         db.projects[i].photos.map((y, j) => {
            if(db.projects[i].photos[j].photoId == photoId){
               db.projects[i].photos[j].name = newName;
               renameMarker(photoId, newName);
               found++;
               getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
               alert('Foto renomeada com sucesso.');
            }
         });
      }
   });
   if(found == 0) alert('A foto não foi encontrada. Verifique se o ID da foto e nome do projeto estão corretos.');
}
function addConnection(photoId1, photoId2, projectName){
   if(photoId1 == photoId2){
      alert('É necessário 2 IDs de fotos.');
      return;
   }
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == projectName){
         found++;
         db.projects[i].photos.map((y, j) => {
            if(db.projects[i].photos[j].photoId == photoId1 || db.projects[i].photos[j].photoId == photoId2){
               found++;
            }
         });
      }
   });
   if(found == 3){
      db.projects.map((x, i) => {
         if(db.projects[i].name == projectName){
            let lat1, lat2, lng1, lng2;
            db.projects[i].photos.map((y, j) => {
               if(db.projects[i].photos[j].photoId == photoId1){
                  if(db.projects[i].photos[j].connections.indexOf(photoId2) == -1){
                     db.projects[i].photos[j].connections.push(photoId2);
                     addLine(...db.projects[i].photos[j].latLng, photoId1, photoId2);
                     getToken().then(t => updateConnections(t, photoId1, db.projects[i].photos[j].connections));
                  }
               }
               if(db.projects[i].photos[j].photoId == photoId2){
                  if(db.projects[i].photos[j].connections.indexOf(photoId1) == -1){
                     db.projects[i].photos[j].connections.push(photoId1);
                     addLine(...db.projects[i].photos[j].latLng, photoId1, photoId2);
                     getToken().then(t => updateConnections(t, photoId2, db.projects[i].photos[j].connections));
                  }
               }
            });
         }
      });
      getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
      alert('Conexão criada com sucesso.');
   }else{
      alert('Algo não foi encontrado. Verifique se as informações estão corretas.');
   }
}
function removeConnection(photoId1, photoId2, projectName){
   if(photoId1 == photoId2){
      alert('São necessário 2 IDs diferentes.');
      return;
   }
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == projectName){
         found++;
         db.projects[i].photos.map((y, j) => {
            if(db.projects[i].photos[j].photoId == photoId1 || db.projects[i].photos[j].photoId == photoId2){
               found++;
            }
         });
      }
   });
   if(found == 3){
      db.projects.map((x, i) => {
         if(db.projects[i].name == projectName){
            db.projects[i].photos.map((y, j) => {
               if(db.projects[i].photos[j].photoId == photoId1){
                  found = db.projects[i].photos[j].connections.indexOf(photoId2);
                  if(found != -1){
                     db.projects[i].photos[j].connections.splice(found, 1);
                     getToken().then(t => {
                        updateConnections(t, photoId1, db.projects[i].photos[j].connections);
                     }).catch(e => alert(`Ocorreu um erro ao atualizar as conexões. ${e}`));
                  }
               }
               if(db.projects[i].photos[j].photoId == photoId2){
                  found = db.projects[i].photos[j].connections.indexOf(photoId1);
                  if(found != -1){
                     db.projects[i].photos[j].connections.splice(found, 1);
                     getToken().then(t => {
                        updateConnections(t, photoId2, db.projects[i].photos[j].connections);
                     }).catch(e => alert(`Ocorreu um erro ao atualizar as conexões. ${e}`));
                  }
               }
            });
            removeLine(photoId1, photoId2);
         }
      });
      getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
      alert('Conaxão removida com sucesso.')
   }else{
      alert('Algo não foi encontrado. Verifique se as informações estão corretas.');
   }
}
function removeProject(name){
   db.projects.map((x, i) => {
      if(db.projects[i].name == name){
         if(db.projects[i].photos.length > 0){
            alert('Não é permitido apagar projetos que possuem fotos. Remova todas as fotos antes.');
         }else{
            if(window.confirm('Você tem certeza que quer deletar o projeto?')){
               db.projects.splice(i, 1);
               getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
               listProjects();
               alert('Projeto apagado com sucesso');
            }
         }
      }
   });
}
function renameProject(currentName){
   let newName = prompt('Escolha um nome para o projeto.');
   if(newName === null) return;
   if(newName.length == 0){
      alert('O nome precisa ter pelo menos 1 caractere.');
      return;
   }
   let found = 0;
   db.projects.map((x, i) => {
      if(db.projects[i].name == currentName){
         db.projects[i].name = newName;
         found++;
      }
   });
   if(found > 0){
      getToken().then(t => updateFile(t, JSON.stringify(db), db.idOnDrive));
      listProjects();
      alert('Projeto renomeado com sucesso.');
   }else{
      alert('Este projeto não existe.');
   }
}