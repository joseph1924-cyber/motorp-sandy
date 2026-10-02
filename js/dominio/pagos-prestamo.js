/* Pagos de préstamo — aplicación por cuota, control e historial
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function loanPaymentPreview(p,m){
  if(!p||!(m>0)) return '';
  const cuotas=(p.cuotas||[]).filter(q=>q.estado!=='Pagada' && Number(q.montoRestante??q.monto)>0);
  let left=m,nums=[];
  for(const q of cuotas){
    if(left<=.004) break;
    const pendiente=Number(q.montoRestante??q.monto);
    const ap=Math.min(left,pendiente);
    if(ap>.004) nums.push({numero:q.numero,completa:ap>=pendiente-.004});
    left-=ap;
  }
  if(!nums.length) return '';
  const total=p.totalCuotas||cuotas.length;
  const a=nums[0].numero,b=nums[nums.length-1].numero;
  if(nums.length===1) return (nums[0].completa?'Saldo':'Abono')+' cuota '+a+' de '+total;
  const todasCompletas=nums.every(x=>x.completa);
  return (todasCompletas?'Saldo':'Abono')+' cuotas '+a+'–'+b+' de '+total;
}

function actualizarReferenciaPagoPrestamo(){
  const pid=$('prp-prestamo')?.value, m=+$('prp-monto')?.value||0, p=db.prestamos.find(x=>x.id===pid);
  if($('prp-ref')) $('prp-ref').value=loanPaymentPreview(p,m);
}

function saldoAntesPagoPrestamo(pay,p){
  if(!p||!pay) return 0;
  const idx=db.pagosPrestamos.indexOf(pay);
  // El saldo actual del préstamo ya descuenta este pago. Para mantener
  // la cadena exacta del comprobante, el balance anterior de esta cuota
  // debe ser el saldo actual + este pago + cualquier pago posterior.
  let saldo=Number(p.saldo||0)+Number(pay.monto||0);
  db.pagosPrestamos.forEach((q,i)=>{
    if(q.prestamoId!==pay.prestamoId || q===pay) return;
    const after=(q.fecha||'')>(pay.fecha||'') || ((q.fecha||'')===(pay.fecha||'') && i>idx);
    if(after) saldo+=Number(q.monto||0);
  });
  return Math.round(saldo*100)/100;
}

function fillControlCuotasPrestamo(){
 const sel=$('cqp-prestamo');if(!sel)return;
 const prev=sel.value;
 sel.innerHTML='<option value="">Seleccione...</option>'+db.prestamos.map(p=>`<option value="${p.id}">${esc(p.codigo)} — ${esc(creditorName(p.acreedorId))} — RD$ ${money(p.saldo)}</option>`).join('');
 if(prev&&db.prestamos.some(p=>p.id===prev))sel.value=prev;
 prepararControlCuotaPrestamo();
}

function prepararControlCuotaPrestamo(preserveManual=false){
 const pid=$('cqp-prestamo')?.value,p=db.prestamos.find(x=>x.id===pid);if(!p)return;
 const numEl=$('cqp-numero'),fechaEl=$('cqp-fecha'),montoEl=$('cqp-monto'),estadoEl=$('cqp-estado'),metodoEl=$('cqp-metodo'),refEl=$('cqp-ref');
 let n=Number(numEl?.value||0);
 if(!preserveManual||n<=0){const next=p.cuotas?.find(q=>q.estado!=='Pagada')||p.cuotas?.[p.cuotas.length-1];n=Number(next?.numero||p.proximaCuota||1);if(numEl)numEl.value=n;}
 const q=(p.cuotas||[]).find(x=>Number(x.numero)===n);
 if(q){
   if(fechaEl)fechaEl.value=q.fecha||p.proximoVencimiento||'';
   if(montoEl)montoEl.value=Number(q.monto||q.montoRestante||p.cuota||0).toFixed(2);
   if(estadoEl)estadoEl.value=q.estado==='Pagada'?'Pagada':'Pendiente';
 }else{
   if(!preserveManual){if(fechaEl)fechaEl.value=p.proximoVencimiento||'';if(montoEl)montoEl.value=Number(p.cuota||0).toFixed(2);if(estadoEl)estadoEl.value='Pendiente';}
 }
 if(metodoEl&&estadoEl?.value==='Pendiente')metodoEl.value='No aplica aún';
 if(refEl&&!q)refEl.value='';
renderComprobantesCuotaPrestamo();}

function renderComprobantesCuotaPrestamo(){
 const pid=$('cqp-prestamo')?.value||'',box=$('cqp-comprobantes');if(!box)return;
 const p=db.prestamos.find(x=>x.id===pid);
 const qs=(p?.cuotas||[]).slice().sort((a,b)=>Number(a.numero)-Number(b.numero));
 box.innerHTML=qs.length?`<div class="section-title" style="margin-top:6px">Comprobantes de cuotas registradas</div><table><thead><tr><th>Comprobante</th><th>Cuota</th><th>Vencimiento</th><th class="r">Monto</th><th>Estado</th><th class="no-print">Acción</th></tr></thead><tbody>${qs.map(q=>`<tr><td><b>${esc(q.codigo||'—')}</b></td><td>#${q.numero}</td><td>${fmtDate(q.fecha)}</td><td class="r">RD$ ${money(q.montoRestante??q.monto)}</td><td><span class="pill ${q.estado==='Pagada'?'green':'yellow'}">${esc(q.estado||'Pendiente')}</span></td><td class="no-print"><button class="btn secondary" type="button" onclick="printRecord('cuotaPrestamo','${p.id}','${q.numero}')">Imprimir</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No hay cuotas registradas para este préstamo.</div>';
}

function imprimirCuotaPrestamoSeleccionada(){
 const pid=$('cqp-prestamo')?.value||'',numero=Number($('cqp-numero')?.value||0),p=db.prestamos.find(x=>x.id===pid),q=(p?.cuotas||[]).find(x=>Number(x.numero)===numero);
 if(!p||!q)return notify('Selecciona un préstamo y una cuota ya registrada para imprimir su comprobante');
 if(!q.codigo){q.codigo=code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]));save();}
 printRecord('cuotaPrestamo',p.id,String(q.numero));
}

function registrarCuotaPrestamoControl(){
 const pid=$('cqp-prestamo')?.value,p=db.prestamos.find(x=>x.id===pid),numero=Math.max(1,Math.floor(+$('cqp-numero')?.value||0)),fecha=$('cqp-fecha')?.value||'',monto=Math.round((+$('cqp-monto')?.value||0)*100)/100,estado=$('cqp-estado')?.value||'Pendiente',metodo=$('cqp-metodo')?.value||'No aplica aún',ref=$('cqp-ref')?.value?.trim()||'';
 if(!p)return notify('Selecciona el préstamo');
 if(numero>Number(p.totalCuotas||0))return notify('El número de cuota supera el plazo total del préstamo');
 if(!fecha)return notify('Indica la fecha de vencimiento de la cuota');
 if(monto<=0)return notify('Indica el monto de la cuota');
 let q=(p.cuotas||[]).find(x=>Number(x.numero)===numero);
 if(q?.estado==='Pagada'&&estado==='Pagada')return notify('Esa cuota ya está registrada como pagada');
 if(estado==='Pagada'){
   const primeraPendiente=(p.cuotas||[]).find(x=>x.estado!=='Pagada');
   if(primeraPendiente && Number(primeraPendiente.numero)!==numero)return notify('Para marcar una cuota como pagada debes registrar primero la cuota pendiente #'+primeraPendiente.numero);
   if(monto>Number(p.saldo||0)+.004)return notify('La cuota supera el saldo de capital disponible del préstamo');
   if(!['Transferencia','Efectivo','Cheque','Tarjeta'].includes(metodo))return notify('Selecciona el método de pago de la cuota');
   if(!q){
     q={numero,fecha,monto,montoRestante:monto,capital:monto,interes:0,seguro:0,estado:'Pendiente',codigo:code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]))};
     p.cuotas.push(q);p.cuotas.sort((a,b)=>Number(a.numero)-Number(b.numero));
   }else{
     if(!q.codigo)q.codigo=code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]));
     const yaAplicado=Math.max(0,Number(q.monto||0)-Number(q.montoRestante??q.monto));
     if(yaAplicado>.004&&Math.abs(yaAplicado-monto)>.004)return notify('La cuota ya tiene un abono y no puede redefinirse de esa manera');
     q.fecha=fecha;q.monto=monto;q.montoRestante=monto;q.capital=Number(q.capital||monto);q.interes=Number(q.interes||0);q.seguro=Number(q.seguro||0);
   }
   const r=applyLoanPayment(p,monto);
   if(r.applied<monto-.004)return notify('No fue posible aplicar la cuota completa');
   db.pagosPrestamos.push({id:uid(),codigo:code('PPR',db.pagosPrestamos),prestamoId:p.id,fecha,monto,metodo,referencia:ref||('Cuota #'+numero),aplicaciones:r.apps,estado:'Activo',origen:'control-cuota',creado:new Date().toISOString()});
 }else{
   if(q?.estado==='Pagada')return notify('Una cuota pagada no puede volver a quedar pendiente desde este control; registra una reversión desde el historial de pagos.');
   if(!q){q={numero,fecha,monto,montoRestante:monto,capital:monto,interes:0,seguro:0,estado:'Pendiente',codigo:code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]))};p.cuotas.push(q);}else{if(!q.codigo)q.codigo=code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]));q.fecha=fecha;q.monto=monto;q.montoRestante=monto;q.estado='Pendiente';}
   p.cuotas.sort((a,b)=>Number(a.numero)-Number(b.numero));
   const next=p.cuotas.find(x=>x.estado!=='Pagada');p.proximaCuota=next?next.numero:p.totalCuotas;p.proximoVencimiento=next?next.fecha:'';p.cuotasPagadas=p.cuotas.filter(x=>x.estado==='Pagada').length;
 }
 const next=p.cuotas.find(x=>x.estado!=='Pagada');p.proximaCuota=next?next.numero:p.totalCuotas;p.proximoVencimiento=next?next.fecha:'';p.cuotasPagadas=p.cuotas.filter(x=>x.estado==='Pagada').length;
 save();fillControlCuotasPrestamo();renderCxp();renderCronograma();renderDashboard();renderHistorialPagos();
 if($('cqp-prestamo'))$('cqp-prestamo').value=p.id;prepararControlCuotaPrestamo();renderComprobantesCuotaPrestamo();
 notify(estado==='Pagada'?'Cuota registrada como pagada':'Cuota registrada como pendiente y enviada al cronograma');
}

function loanBalanceAtDate(p,hasta){
 const original=Number(p.montoOriginal||0),inicial=Number(p.pagosIniciales||0);
 let pagadoCapital=0;
 (p.historialPrevio||[]).forEach(h=>{if((h.fecha||p.fechaInicio||'')<=hasta)pagadoCapital+=Number(h.capital||0)});
 (db.pagosPrestamos||[]).filter(pg=>pg.prestamoId===p.id&&pagoPrestamoActivo(pg)&&String(pg.fecha||'')<=hasta).forEach(pg=>{
   (pg.aplicaciones||[]).forEach(a=>pagadoCapital+=Number(a.capitalAplicado??a.aplicado??0));
 });
 if(pagadoCapital<=.004&&inicial>.004){pagadoCapital=inicial;}
 return Math.max(0,Math.round((original-pagadoCapital)*100)/100);
}

function loanPaidInstallmentsAtDate(p,hasta){
 const applied={};
 (db.pagosPrestamos||[]).filter(pg=>pg.prestamoId===p.id&&pagoPrestamoActivo(pg)&&String(pg.fecha||'')<=hasta).forEach(pg=>(pg.aplicaciones||[]).forEach(a=>{applied[a.numero]=(applied[a.numero]||0)+Number(a.aplicado||0)}));
 return (p.cuotas||[]).filter(q=>Number(applied[q.numero]||0)>=Number(q.monto||0)-.004&&String(q.fecha||'')<=hasta).length;
}

function addPagoPrestamo(){const pid=$('prp-prestamo').value,m=+$('prp-monto').value,fecha=$('prp-fecha').value||today(),p=db.prestamos.find(x=>x.id===pid);if(!p||m<=0)return notify('Selecciona un préstamo y un monto');if(m>p.saldo+.004)return notify('El pago supera el saldo del préstamo');const referencia=loanPaymentPreview(p,m);if(!referencia)return notify('No se pudo determinar la cuota del préstamo');if(!confirm(`¿Confirmas registrar el pago de préstamo por RD$ ${money(m)}?`))return;const r=applyLoanPayment(p,m);if(r.applied<m-.004)return notify('No hay saldo suficiente para aplicar todo el monto');db.pagosPrestamos.push({id:uid(),codigo:code('PPR',db.pagosPrestamos),prestamoId:pid,fecha,monto:m,metodo:$('prp-metodo').value,referencia,aplicaciones:r.apps,estado:'Activo',creado:new Date().toISOString()});save();$('prp-monto').value='';$('prp-ref').value='';renderCxp();renderCronograma();renderDashboard();renderHistorialPagos();notify('Pago de préstamo registrado')}

function renderHistorialPagos(){const rows=[];db.pagosPrestamos.forEach(x=>{const p=db.prestamos.find(z=>z.id===x.prestamoId);rows.push({type:'pagoPrestamo',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:'Préstamo',acreedor:creditorName(p?.acreedorId),ref:x.referencia,monto:x.monto,estado:x.estado||'Activo'})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.codigo.localeCompare(a.codigo));$('tbl-pagos-oblig').innerHTML=rows.length?rows.map(x=>{const anulado=x.estado==='Anulado';return `<tr class="${anulado?'muted-row':''}"><td>${x.codigo}</td><td>${fmtDate(x.fecha)}</td><td>${x.acreedor}</td><td>${x.ref||'—'}</td><td class="r">${money(x.monto)}</td><td><span class="pill ${anulado?'red':'green'}">${anulado?'Anulado':'Activo'}</span></td><td class="no-print action-cell"><div class="action-buttons"><button class="btn secondary" onclick="printRecord('${x.type}','${x.id}')">Imprimir</button>${anulado?'':`<button class="btn secondary" onclick="openEditor('${x.type}','${x.id}')">Editar</button><button class="btn danger" onclick="anularPagoPrestamo('${x.id}')">Anular</button>`}</div></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">Sin pagos de préstamos registrados.</td></tr>'}

function anularPagoPrestamo(id){const pay=db.pagosPrestamos.find(x=>x.id===id);if(!pay)return;if(pay.estado==='Anulado')return notify('El comprobante ya está anulado');const p=db.prestamos.find(x=>x.id===pay.prestamoId);if(!p)return notify('Préstamo no encontrado');const motivo=prompt(`Indica el motivo de anulación del comprobante ${pay.codigo}:`,'');if(motivo===null)return;if(!String(motivo).trim())return notify('Debes indicar el motivo de la anulación');if(!confirm(`¿Anular el comprobante ${pay.codigo} por RD$ ${money(pay.monto)}? El monto será devuelto al saldo del préstamo y el documento permanecerá en el historial.`))return;reverseLoanPayment(p,pay);pay.estado='Anulado';pay.anuladoEn=new Date().toISOString();pay.motivoAnulacion=String(motivo).trim();save();renderCxp();renderCronograma();renderDashboard();renderHistorialPagos();notify(`Comprobante ${pay.codigo} anulado; saldo del préstamo restaurado`)}

function delPagoPrestamo(id){return anularPagoPrestamo(id)}
