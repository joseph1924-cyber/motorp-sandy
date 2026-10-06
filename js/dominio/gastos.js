/* Gastos operacionales — registro, anulación y listado
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function cancelarRegistroGasto(){
  if($('ga-fecha'))$('ga-fecha').value=today();
  if($('ga-cat'))$('ga-cat').selectedIndex=0;
  if($('ga-acreedor'))$('ga-acreedor').value='';
  if($('ga-benef'))$('ga-benef').value='';
  if($('ga-desc'))$('ga-desc').value='';
  if($('ga-monto'))$('ga-monto').value='';
  if($('ga-venc'))$('ga-venc').value='';
  if($('ga-estado'))$('ga-estado').value='Pagado';
  if($('ga-metodo'))$('ga-metodo').selectedIndex=0;
  notify('Operación cancelada: no se registró ningún gasto');
}

function addGasto(){
  const monto=+$('ga-monto').value;if(monto<=0)return notify('Monto obligatorio');
  const aid=$('ga-acreedor').value||null,fecha=$('ga-fecha').value||today(),estado=$('ga-estado').value,venc=$('ga-venc').value;
  if(estado==='Pendiente'&&!aid)return notify('Para un gasto pendiente debes seleccionar o crear el acreedor en el catálogo');
  const g={id:uid(),codigo:code('GO',db.gastos),fecha,categoria:$('ga-cat').value,beneficiario:$('ga-benef').value||creditorName(aid),descripcion:$('ga-desc').value,monto,vencimiento:venc,estado,metodo:$('ga-metodo').value,acreedorId:aid,obligacionId:null};
  db.gastos.push(g);
  if(estado==='Pendiente'){
    const o={id:uid(),codigo:code('OB',db.obligaciones),acreedorId:aid,tipo:$('ga-cat').value==='Nómina'?'Nómina':$('ga-cat').value==='Alquiler'?'Alquiler':$('ga-cat').value==='Energía eléctrica'||$('ga-cat').value==='Internet / teléfono'||$('ga-cat').value==='Agua'?'Servicio':'Otro gasto',fecha,vencimiento:venc||fecha,descripcion:$('ga-desc').value||$('ga-cat').value,monto,saldo:monto,estado:'Pendiente',gastoId:g.id};
    db.obligaciones.push(o);g.obligacionId=o.id;
  }
  save();
  $('ga-monto').value='';$('ga-desc').value='';
  renderGastos();renderCxp();renderCronograma();renderDashboard();
  notify(estado==='Pendiente'?'Gasto registrado y obligación pendiente creada':'Gasto registrado');
}

function anularGasto(id){const g=db.gastos.find(x=>x.id===id);if(!g)return;if(g.estado==='Anulado')return notify('El comprobante ya está anulado');const o=g.obligacionId?db.obligaciones.find(x=>x.id===g.obligacionId):null;const motivo=prompt(`Indica el motivo de anulación del comprobante ${g.codigo}:`,'');if(motivo===null)return;if(!String(motivo).trim())return notify('Debes indicar el motivo de la anulación');if(!confirm(`¿Anular el comprobante ${g.codigo} por RD$ ${money(g.monto)}? El documento permanecerá registrado para conservar la secuencia.`))return;g.estado='Anulado';g.anuladoEn=new Date().toISOString();g.motivoAnulacion=String(motivo).trim();if(o){o.estado='Anulada';o.saldo=0;o.anuladoEn=g.anuladoEn;o.motivoAnulacion=g.motivoAnulacion;}save();renderGastos();renderCxp();renderCronograma();renderDashboard();notify(`Comprobante ${g.codigo} anulado; la secuencia fue conservada`)}

function delGasto(id){return anularGasto(id)}

function renderGastos(){fillAcreedores();const a=$('ga-desde').value,b=$('ga-hasta').value,f=$('ga-filtro').value,l=db.gastos.filter(x=>inRange(x.fecha,a,b)).filter(x=>!f||x.estado===f).sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-gastos').innerHTML=l.length?l.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${fmtDate(x.fecha)}</td><td>${esc(x.categoria)}</td><td>${esc(x.beneficiario||creditorName(x.acreedorId)||'—')}</td><td>${esc(x.descripcion||'—')}</td><td class="r">${money(x.monto)}</td><td><span class="pill ${x.estado==='Pendiente'?'yellow':x.estado==='Anulado'?'red':'green'}">${esc(x.estado)}</span></td><td class="no-print action-cell"><div class="action-buttons"><button class="btn secondary" onclick="openEditor('gasto','${x.id}')">Editar</button><button class="btn secondary" onclick="printRecord('gasto','${x.id}')">Imprimir</button><button class="btn danger" onclick="anularGasto('${x.id}')">Anular</button></div></td></tr>`).join(''):'<tr><td colspan="8" class="empty">Sin gastos.</td></tr>';$('ga-sum').textContent=money(l.reduce((s,x)=>s+x.monto,0));$('ga-pend').textContent=money(l.filter(x=>x.estado==='Pendiente').reduce((s,x)=>s+x.monto,0));fillAcreedores();const obs=db.obligaciones.filter(o=>o.saldo>.004).map(o=>`<option value="${esc(o.id)}">${esc(creditorName(o.acreedorId))} — ${esc(o.descripcion||o.tipo)} — ${money(o.saldo)}</option>`).join('');if($('obp-obligacion'))$('obp-obligacion').innerHTML='<option value="">Seleccione...</option>'+obs;renderHistorialGastos()}
