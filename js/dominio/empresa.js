/* Empresa — datos, logo y marca
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function saveEmpresa(){db.empresa.nombre=$('em-nombre').value||'Moto Repuesto Sandy';db.empresa.rnc=$('em-rnc').value;db.empresa.tel=$('em-tel').value;db.empresa.email=$('em-email').value;db.empresa.dir=$('em-dir').value;db.empresa.eslogan=$('em-eslogan').value;db.empresa.margen=Number($('em-margen').value)||30;save();updateBrand();renderDashboard();renderEmpresa();notify('Datos de empresa guardados')}

function loadLogo(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{db.empresa.logo=r.result;$('em-logo-preview').src=r.result;save()};r.readAsDataURL(f)}

function renderEmpresa(){$('em-nombre').value=db.empresa.nombre||'';$('em-rnc').value=db.empresa.rnc||'';$('em-tel').value=db.empresa.tel||'';$('em-email').value=db.empresa.email||'';$('em-dir').value=db.empresa.dir||'';$('em-eslogan').value=db.empresa.eslogan||'';$('em-margen').value=db.empresa.margen??30;if(db.empresa.logo)$('em-logo-preview').src=db.empresa.logo;$('empresa-ficha').innerHTML=`<h2>${db.empresa.nombre||'Empresa'}</h2><p>${db.empresa.eslogan||''}</p><p>RNC: ${db.empresa.rnc||'—'}<br>${db.empresa.dir||''}<br>${db.empresa.tel||''} · ${db.empresa.email||''}</p><p>Margen bruto estimado: <b>${db.empresa.margen||30}%</b></p>`}

function updateBrand(){$('brand').innerHTML=(db.empresa.nombre||'Moto Repuesto Sandy')+'<small>Gestión financiera y operacional</small>'}
