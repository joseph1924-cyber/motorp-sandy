/* Pagos a suplidor — aplicación a facturas y comprobantes
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function obtenerFacturasPagoSp(sid){
 const m=+$('pg-monto')?.value||0;let left=Math.max(0,m);
 return db.facturasSuplidor.filter(x=>x.suplidorId===sid&&x.saldo>.004).sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento)).map(f=>{const aplicado=Math.min(left,Number(f.saldo||0));left-=aplicado;return {f,aplicado,nuevo:Math.max(0,Number(f.saldo||0)-aplicado)}}).filter(x=>x.aplicado>.004);
}

function supplierTotalBalance(sid){return Math.round(db.facturasSuplidor.filter(f=>f.suplidorId===sid).reduce((z,f)=>z+Number(f.saldo||0),0)*100)/100}

function actualizarReferenciaPagoSp(){
 const sid=$('pg-sp')?.value,m=+$('pg-monto')?.value||0,ref=$('pg-ref');if(!ref)return;
 if(!sid||m<=0){ref.value='';renderFacturasPagoSp();return}
 const total=supplierTotalBalance(sid);if(m>total+.004){ref.value='Monto superior al saldo del suplidor';renderFacturasPagoSp();return}
 const apps=obtenerFacturasPagoSp(sid),saldadas=apps.filter(x=>x.nuevo<=.004).length,abonadas=apps.filter(x=>x.nuevo>.004).length,partes=[];
 if(saldadas)partes.push(`${saldadas} ${saldadas===1?'factura saldada':'facturas saldadas'}`);if(abonadas)partes.push(`${abonadas} ${abonadas===1?'factura con abono':'facturas con abono'}`);
 ref.value=partes.join(' y ')||'Sin aplicación';renderFacturasPagoSp();
}

function renderFacturasPagoSp(){
 const sid=$('pg-sp').value,fs=db.facturasSuplidor.filter(x=>x.suplidorId===sid&&x.saldo>.004).sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento));let left=Math.max(0,+$('pg-monto')?.value||0);
 const rows=fs.map(x=>{const aplicado=Math.min(left,Number(x.saldo||0));left-=aplicado;return {x,aplicado,nuevo:Math.max(0,Number(x.saldo||0)-aplicado)}});
 $('pg-facturas').innerHTML=rows.length?`<table><thead><tr><th>Factura</th><th>Vence</th><th class="r">Saldo</th><th class="r">Aplicado</th><th>Tipo</th><th class="r">Balance actual</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.x.documento||r.x.codigo}</td><td>${fmtDate(r.x.vencimiento)}</td><td class="r">${money(r.x.saldo)}</td><td class="r">${money(r.aplicado)}</td><td>${r.aplicado>.004?(r.nuevo<=.004?'Saldo':'Abono'):'—'}</td><td class="r">${money(r.nuevo)}</td></tr>`).join('')}</tbody></table>`:'';
}

function addPagoSuplidor(){
 const sid=$('pg-sp').value,m=+$('pg-monto').value,fecha=$('pg-fecha').value||today();if(!sid||m<=0)return notify('Suplidor y monto son obligatorios');
 const saldoAnterior=supplierTotalBalance(sid);if(m>saldoAnterior+.004)return notify(`El pago supera el saldo total del suplidor: RD$ ${money(saldoAnterior)}`);
 if(!confirm(`¿Confirmas registrar el pago al suplidor por RD$ ${money(m)}?`))return;
 let left=m,apps=[];db.facturasSuplidor.filter(x=>x.suplidorId===sid&&x.saldo>.004).sort((a,b)=>a.vencimiento.localeCompare(b.vencimiento)).forEach(f=>{if(left<=.004)return;const ap=Math.min(left,f.saldo);f.saldo=Math.round((f.saldo-ap)*100)/100;left-=ap;apps.push({facturaId:f.id,aplicado:ap,saldoFinal:f.saldo})});
 const aplicado=Math.round((m-left)*100)/100;if(aplicado<=.004)return notify('No hay saldo pendiente');const saldoActual=Math.round((saldoAnterior-aplicado)*100)/100;
 const saldadas=apps.filter(a=>Number(a.saldoFinal||0)<=.004).length,abonadas=apps.filter(a=>Number(a.saldoFinal||0)>.004).length,partes=[];if(saldadas)partes.push(`${saldadas} ${saldadas===1?'factura saldada':'facturas saldadas'}`);if(abonadas)partes.push(`${abonadas} ${abonadas===1?'factura con abono':'facturas con abono'}`);
 db.pagosSuplidor.push({id:uid(),codigo:code('RP',db.pagosSuplidor),suplidorId:sid,fecha,monto:aplicado,metodo:$('pg-metodo').value,referencia:partes.join(' y '),saldoAnterior,saldoActual,aplicaciones:apps});save();$('pg-monto').value='';$('pg-ref').value='';renderCxp();renderCronograma();renderDashboard();renderHistorialPagos();renderFacturasPagoSp();notify('Transacción realizada con éxito: pago a suplidor registrado');
}

function cancelarPagoSuplidor(id){const p=db.pagosSuplidor.find(x=>x.id===id);if(!p)return notify('Pago a suplidor no encontrado');if(!confirm(`¿Confirmas cancelar el pago ${p.codigo} por RD$ ${money(p.monto)}? Esta acción devolverá los saldos a las facturas afectadas.`))return;reverseSupplierPayment(p);db.pagosSuplidor=db.pagosSuplidor.filter(x=>x.id!==id);save();renderCxp();renderCronograma();renderDashboard();renderHistorialPagos();renderFacturasPagoSp();notify('Transacción realizada con éxito: pago a suplidor cancelado')}

function renderPagosSp(){const l=[...db.pagosSuplidor].sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-pagos-sp').innerHTML=l.length?l.map(x=>{const s=db.suplidores.find(q=>q.id===x.suplidorId);return `<tr><td>${x.codigo}</td><td>${fmtDate(x.fecha)}</td><td>${s?s.nombre:'—'}</td><td>${x.referencia||'—'}</td><td class="r">${money(x.monto)}</td><td class="no-print action-cell"><div class="action-buttons"><button class="btn secondary" onclick="openEditor('pagoSuplidor','${x.id}')">Editar</button><button class="btn secondary" onclick="printPagoSp('${x.id}')">Imprimir</button><button class="btn danger" onclick="cancelarPagoSuplidor('${x.id}')">Cancelar pago</button></div></td></tr>`}).join(''):'<tr><td colspan="6" class="empty">Sin pagos.</td></tr>'}

function supplierBalanceBeforePayment(p){
 if(Number.isFinite(Number(p.saldoAnterior)))return Number(p.saldoAnterior);
 const payments=db.pagosSuplidor,pIndex=payments.indexOf(p);let total=db.facturasSuplidor.filter(f=>f.suplidorId===p.suplidorId&&(!p.fecha||!f.fecha||f.fecha<=p.fecha)).reduce((z,f)=>z+Number(f.total||0),0);
 payments.forEach((q,i)=>{if(q===p||q.suplidorId!==p.suplidorId)return;const before=q.fecha<p.fecha||(q.fecha===p.fecha&&i<pIndex);if(before)total-=Number(q.monto||0)});return Math.max(0,Math.round(total*100)/100)
}
