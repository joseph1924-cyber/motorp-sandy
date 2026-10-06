/* Obligaciones — registro, pago e historial
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function addObligacion(){const aid=$('ob-acreedor').value,tipo=$('ob-tipo').value,fecha=$('ob-fecha').value||today(),venc=$('ob-venc').value||fecha,monto=+$('ob-monto').value,desc=$('ob-desc').value.trim();if(!aid||monto<=0)return notify('Acreedor y monto son obligatorios');const o={id:uid(),codigo:code('OB',db.obligaciones),acreedorId:aid,tipo,fecha,vencimiento:venc,descripcion:desc,monto,saldo:monto,estado:'Pendiente',gastoId:null};db.obligaciones.push(o);const g={id:uid(),codigo:code('GO',db.gastos),fecha,categoria:tipo==='Servicio'?(creditorById(aid)?.categoria==='Servicios'?'Servicios':(desc.toLowerCase().includes('internet')?'Internet / teléfono':'Energía eléctrica')):tipo==='Nómina'?'Nómina':tipo==='Alquiler'?'Alquiler':tipo==='Impuesto'?'Otros':'Otros',beneficiario:creditorName(aid),descripcion:desc,monto,vencimiento:venc,estado:'Pendiente',metodo:'No aplica aún',obligacionId:o.id,acreedorId:aid};db.gastos.push(g);o.gastoId=g.id;save();$('ob-monto').value='';$('ob-desc').value='';renderCxp();renderGastos();renderCronograma();renderDashboard();notify('Obligación registrada y vinculada a gastos operacionales')}

function addPagoObligacion(){const oid=$('obp-obligacion').value,m=+$('obp-monto').value,fecha=$('obp-fecha').value||today();const o=db.obligaciones.find(x=>x.id===oid);if(!o||m<=0)return notify('Selecciona una obligación y un monto');if(m>o.saldo+.004)return notify('El pago supera el saldo de la obligación');o.saldo=Math.round((o.saldo-m)*100)/100;o.estado=o.saldo<=.004?'Pagada':'Pendiente';db.pagosObligaciones.push({id:uid(),codigo:code('POB',db.pagosObligaciones),obligacionId:oid,fecha,monto:m,metodo:$('obp-metodo').value,referencia:$('obp-ref').value});const g=db.gastos.find(x=>x.id===o.gastoId);if(g){g.estado=o.saldo<=.004?'Pagado':'Pendiente';if(o.saldo<=.004)g.metodo=$('obp-metodo').value;}save();$('obp-monto').value='';$('obp-ref').value='';renderCxp();renderGastos();renderCronograma();renderDashboard();renderHistorialPagos();notify('Pago de obligación registrado')}

function obligacionVigente(o){
  if(!o) return false;
  if(o.gastoId){
    const g=db.gastos.find(x=>x.id===o.gastoId);
    if(!g) return false;
    if(g.obligacionId && g.obligacionId!==o.id) return false;
  }
  return true;
}

function limpiarObligacionesHuerfanas(){
  const antes=db.obligaciones.length;
  db.obligaciones=db.obligaciones.filter(o=>!(o.gastoId && !db.gastos.some(g=>g.id===o.gastoId) && Number(o.saldo||0)>.004));
  return db.obligaciones.length!==antes;
}

function renderHistorialGastos(){const rows=[];db.pagosObligaciones.forEach(x=>{const o=db.obligaciones.find(z=>z.id===x.obligacionId);rows.push({type:'pagoObligacion',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:o?.tipo||'Gasto',acreedor:creditorName(o?.acreedorId),ref:x.referencia,monto:x.monto})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-pagos-gastos').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${fmtDate(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(x.acreedor)}</td><td>${esc(x.ref||'—')}</td><td class="r">${money(x.monto)}</td><td class="no-print action-cell"><div class="action-buttons"><button class="btn secondary" onclick="openEditor('${x.type}','${x.id}')">Editar</button><button class="btn secondary" onclick="printRecord('${x.type}','${x.id}')">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Sin pagos de gastos registrados.</td></tr>'}
