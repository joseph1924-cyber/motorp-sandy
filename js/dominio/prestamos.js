/* Préstamos — captura, tabla de amortización, resumen y recepción
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function loanSituacion(){return document.querySelector('input[name="pr-situacion"]:checked')?.value||'nuevo'}

function loanAmort(){return document.querySelector('input[name="pr-amort"]:checked')?.value||'no'}

function addPrestamoHistRow(v={}){const tb=$('pr-historial-body');if(!tb)return;const n=tb.children.length+1;const tr=document.createElement('tr');tr.innerHTML=`<td class="mini">${n}</td><td><input type="date" class="prh-fecha" value="${v.fecha||''}"></td><td><input class="prh-ref" value="${esc(v.referencia||'')}" placeholder="Comprobante"></td><td><input type="number" step="0.01" class="prh-capital" value="${v.capital??''}" oninput="actualizarResumenPrestamo()"></td><td><input type="number" step="0.01" class="prh-interes" value="${v.interes??''}"></td><td><input type="number" step="0.01" class="prh-seguro" value="${v.seguro??''}"></td><td><input type="number" step="0.01" class="prh-total" value="${v.total??''}"></td><td><button type="button" class="btn danger row-remove" onclick="this.closest('tr').remove();renumerarFilasPrestamo('pr-historial-body');actualizarResumenPrestamo()">×</button></td>`;tb.appendChild(tr);renumerarFilasPrestamo('pr-historial-body');actualizarResumenPrestamo()}

function addPrestamoAmortRow(v={}){const tb=$('pr-amort-body');if(!tb)return;const n=tb.children.length+1;const tr=document.createElement('tr');tr.innerHTML=`<td class="mini"><input type="number" class="pra-num" value="${v.numero??n}"></td><td><input type="date" class="pra-fecha" value="${v.fecha||''}"></td><td><input type="number" step="0.01" class="pra-capital" value="${v.capital??''}" oninput="actualizarResumenPrestamo()"></td><td><input type="number" step="0.01" class="pra-interes" value="${v.interes??''}"></td><td><input type="number" step="0.01" class="pra-seguro" value="${v.seguro??''}"></td><td><input type="number" step="0.01" class="pra-cuota" value="${v.monto??''}"></td><td><input type="number" step="0.01" class="pra-saldo" value="${v.saldoCapital??''}"></td><td><button type="button" class="btn danger row-remove" onclick="this.closest('tr').remove();renumerarFilasPrestamo('pr-amort-body');actualizarResumenPrestamo()">×</button></td>`;tb.appendChild(tr);renumerarFilasPrestamo('pr-amort-body');actualizarResumenPrestamo()}

function renumerarFilasPrestamo(id){const tb=$(id);if(!tb)return;[...tb.children].forEach((tr,i)=>{const c=tr.querySelector('.mini');if(c&&!c.querySelector('input'))c.textContent=i+1})}

function generarTablaAmortizacionAutomatica(){
 const original=+$('pr-original')?.value||0;
 const tasa=+$('pr-tasa-mensual')?.value||0;
 const seguroPct=+$('pr-seguro')?.value||0;
 const total=Math.max(0,Math.floor(+$('pr-total-cuotas')?.value||0));
 const frecuencia=$('pr-frecuencia')?.value||'Mensual';
 const fechaInicial=$('pr-vencimiento')?.value||'';
 if(original<=0)return notify('Indica el monto original antes de generar la tabla');
 if(total<=0)return notify('Indica el plazo total en cuotas antes de generar la tabla');
 if(!fechaInicial)return notify('Indica la primera / próxima fecha de pago antes de generar la tabla');
 if(tasa<0||seguroPct<0)return notify('Las tasas no pueden ser negativas');
 const mensual=tasa/100,seguroRate=seguroPct/100;
 let cuotaBase=+$('pr-cuota')?.value||0;
 if(cuotaBase<=0){
   if(mensual>0) cuotaBase=original*mensual/(1-Math.pow(1+mensual,-total));
   else cuotaBase=original/total;
   cuotaBase=Math.round(cuotaBase*100)/100;
   if($('pr-cuota'))$('pr-cuota').value=cuotaBase.toFixed(2);
 }
 let saldo=original,fecha=fechaInicial,rows=[];
 for(let n=1;n<=total;n++){
   if(saldo<=0.004)break;
   const interes=Math.round(saldo*mensual*100)/100;
   const seguro=Math.round(saldo*seguroRate*100)/100;
   let capital=Math.round((cuotaBase-interes)*100)/100;
   if(capital<0)capital=0;
   if(capital>saldo)capital=Math.round(saldo*100)/100;
   let cuotaTotal=Math.round((capital+interes+seguro)*100)/100;
   saldo=Math.round((saldo-capital)*100)/100;
   rows.push({numero:n,fecha,capital,interes,seguro,monto:cuotaTotal,saldoCapital:saldo,estado:'Pendiente'});
   fecha=addPeriodo(fecha,frecuencia);
 }
 // Con una cuota fija insuficiente el bucle completa las 12 filas y aun sobra saldo, así
 // que la condición basada en rows.length nunca se cumplía y se escribía una tabla que no
 // amortiza. Basta con mirar el saldo que queda.
 if(saldo>0.004)return notify('Las condiciones no permiten amortizar el préstamo con la cuota indicada');
 const tb=$('pr-amort-body');if(!tb)return;
 tb.innerHTML='';
 rows.forEach(q=>addPrestamoAmortRow(q));
 if($('pr-sum-cuotas'))$('pr-sum-cuotas').textContent=rows.length;
 notify(`Tabla generada automáticamente: ${rows.length} cuotas`);
}

function imprimirTablaAmortizacionCaptura(){
 const rows=[...document.querySelectorAll('#pr-amort-body tr')].map((tr,i)=>({
   numero:tr.querySelector('.pra-num')?.value||i+1,
   fecha:tr.querySelector('.pra-fecha')?.value||'',
   capital:+tr.querySelector('.pra-capital')?.value||0,
   interes:+tr.querySelector('.pra-interes')?.value||0,
   seguro:+tr.querySelector('.pra-seguro')?.value||0,
   cuota:+tr.querySelector('.pra-cuota')?.value||0,
   saldo:+tr.querySelector('.pra-saldo')?.value||0
 }));
 if(!rows.length)return notify('No hay cuotas en la tabla para imprimir');
 const acreedor=creditorName($('pr-acreedor')?.value)||'—';
 const referencia=$('pr-referencia')?.value||'—';
 const original=+$('pr-original')?.value||0;
 const tasa=+$('pr-tasa-mensual')?.value||0;
 const seguro=+$('pr-seguro')?.value||0;
 const total=+$('pr-total-cuotas')?.value||rows.length;
 const cuotaBase=+$('pr-cuota')?.value||0;
 const body=`<h2>Tabla de amortización de préstamo</h2>
 <div class="box"><table class="datos"><tr><td><b>Acreedor</b></td><td>${esc(acreedor)}</td><td><b>Referencia / contrato</b></td><td>${esc(referencia)}</td></tr>
 <tr><td><b>Monto original</b></td><td>RD$ ${money(original)}</td><td><b>Tasa mensual</b></td><td>${tasa}%</td></tr>
 <tr><td><b>Seguro por cuota</b></td><td>${seguro}%</td><td><b>Plazo</b></td><td>${total} cuotas</td></tr>
 <tr><td><b>Cuota base</b></td><td>RD$ ${money(cuotaBase)}</td><td><b>Cuotas mostradas</b></td><td>${rows.length}</td></tr></table></div>
 <table><thead><tr><th>#</th><th>Fecha</th><th class="r">Capital</th><th class="r">Interés</th><th class="r">Seguro</th><th class="r">Cuota total</th><th class="r">Saldo capital</th></tr></thead><tbody>
 ${rows.map(q=>`<tr><td>${q.numero}</td><td>${fmtDate(q.fecha)}</td><td class="r">RD$ ${money(q.capital)}</td><td class="r">RD$ ${money(q.interes)}</td><td class="r">RD$ ${money(q.seguro)}</td><td class="r"><b>RD$ ${money(q.cuota)}</b></td><td class="r">RD$ ${money(q.saldo)}</td></tr>`).join('')}
 </tbody></table><p class="foot">Documento generado por Moto Repuesto Sandy. Valores correspondientes a la tabla capturada/generada en el centro de préstamos.</p>`;
 const w=window.open('','_blank');
 if(!w)return notify('Permite ventanas emergentes para imprimir');
 w.document.write(`<html><head><meta charset="utf-8"><title>Tabla de amortización</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#1c2430;padding:20px}h1,h2{margin:0 0 10px}.box{border:1px solid #ccc;padding:10px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{padding:6px 7px;border-bottom:1px solid #ddd;text-align:left;font-size:10pt}.r{text-align:right}.datos td{border:0;padding:4px 7px}.foot{margin-top:20px;font-size:9pt;color:#666}@media print{body{padding:0}}</style></head><body>${headerPrint()}${body}</body></html>`);
 w.document.close();
 setTimeout(()=>{try{w.focus();w.print()}catch(e){}},250);
}

function togglePrestamoFases(){const h=$('pr-historial-wrap'),a=$('pr-amort-wrap');if(h)h.style.display=loanSituacion()==='existente'?'block':'none';if(a)a.style.display='block';actualizarResumenPrestamo()}

function actualizarResumenPrestamo(){const original=+$('pr-original')?.value||0;const capitalPrev=[...document.querySelectorAll('#pr-historial-body .prh-capital')].reduce((s,i)=>s+(+i.value||0),0);const saldo=Math.max(0,original-capitalPrev);const amort=[...document.querySelectorAll('#pr-amort-body .pra-num')].length;['pr-sum-original','pr-sum-capital','pr-sum-saldo'].forEach((id,i)=>{if($(id))$(id).textContent=money([original,capitalPrev,saldo][i])});if($('pr-sum-cuotas'))$('pr-sum-cuotas').textContent=amort||'0'}

function cancelarRegistroPrestamo(){['pr-referencia','pr-original','pr-tasa-mensual','pr-tasa-anual','pr-seguro','pr-total-cuotas','pr-cuota','pr-vencimiento'].forEach(id=>{if($(id))$(id).value=id==='pr-seguro'?'0':''});if($('pr-fecha'))$('pr-fecha').value=today();if($('pr-acreedor'))$('pr-acreedor').value='';if($('pr-frecuencia'))$('pr-frecuencia').value='Mensual';document.querySelector('input[name="pr-situacion"][value="nuevo"]')?.click();document.querySelector('input[name="pr-amort"][value="no"]')?.click();if($('pr-historial-body'))$('pr-historial-body').innerHTML='';if($('pr-amort-body'))$('pr-amort-body').innerHTML='';actualizarResumenPrestamo();notify('Operación cancelada: no se registró ningún préstamo')}

function addPrestamo(){
 const aid=$('pr-acreedor').value,fecha=$('pr-fecha').value||today(),original=+$('pr-original').value||0,cuota=+$('pr-cuota').value||0,totalCuotas=+$('pr-total-cuotas').value||0,frecuencia=$('pr-frecuencia').value,venc=$('pr-vencimiento').value,situacion=loanSituacion(),tieneAmort=loanAmort()==='si'||document.querySelectorAll('#pr-amort-body tr').length>0;
 if(!aid||original<=0)return notify('Completa acreedor y monto original');
 if(totalCuotas<=0)return notify('Indica el plazo total en cuotas');
 if(!venc)return notify('Indica la primera o próxima fecha de pago');
 const historial=[...document.querySelectorAll('#pr-historial-body tr')].map((tr,i)=>({numero:i+1,fecha:tr.querySelector('.prh-fecha')?.value||fecha,referencia:tr.querySelector('.prh-ref')?.value||'',capital:+tr.querySelector('.prh-capital')?.value||0,interes:+tr.querySelector('.prh-interes')?.value||0,seguro:+tr.querySelector('.prh-seguro')?.value||0,total:+tr.querySelector('.prh-total')?.value||0}));
 if(situacion==='existente'&&historial.some(x=>x.capital<=0&&x.total<=0))return notify('Cada pago anterior debe tener al menos capital o total registrado');
 const capitalHistorico=Math.round(historial.reduce((s,x)=>s+Number(x.capital||0),0)*100)/100;
 if(capitalHistorico>original+.004)return notify('El capital de los pagos anteriores no puede superar el monto original');
 const saldo=Math.round((original-capitalHistorico)*100)/100;
 let cuotas=[];
 if(tieneAmort){
   cuotas=[...document.querySelectorAll('#pr-amort-body tr')].map((tr,i)=>({numero:+tr.querySelector('.pra-num')?.value||i+1,fecha:tr.querySelector('.pra-fecha')?.value||'',capital:+tr.querySelector('.pra-capital')?.value||0,interes:+tr.querySelector('.pra-interes')?.value||0,seguro:+tr.querySelector('.pra-seguro')?.value||0,monto:+tr.querySelector('.pra-cuota')?.value||0,saldoCapital:+tr.querySelector('.pra-saldo')?.value||0,estado:'Pendiente'})).filter(q=>q.monto>0||q.capital>0);
   if(!cuotas.length)return notify('Indica al menos una cuota de la tabla de amortización');
   cuotas.forEach(q=>{q.montoRestante=q.monto;q.fecha=q.fecha||venc});
 }else{
   if(cuota<=0)return notify('Indica la cuota pactada o activa una tabla de amortización');
   let f=venc;const inicio=historial.length+1;
   for(let n=inicio;n<=totalCuotas;n++){cuotas.push({numero:n,fecha:f,monto:cuota,montoRestante:cuota,capital:cuota,interes:0,seguro:0,estado:'Pendiente'});f=addPeriodo(f,frecuencia)}
 }
 const pagadasIniciales=historial.length;
 const proxima=cuotas.find(q=>q.estado!=='Pagada')?.numero||Math.min(totalCuotas,pagadasIniciales+1);
 const p={id:uid(),codigo:code('PRE',db.prestamos),acreedorId:aid,fechaInicio:fecha,referenciaContrato:$('pr-referencia').value.trim(),montoOriginal:original,pagosIniciales:capitalHistorico,saldo,cuota,totalCuotas,cuotasPagadas:pagadasIniciales,proximaCuota:proxima,proximoVencimiento:cuotas.find(q=>q.numero===proxima)?.fecha||venc,frecuencia,modalidad:$('pr-modalidad').value,tasaMensual:+$('pr-tasa-mensual').value||0,tasaAnual:+$('pr-tasa-anual').value||0,seguroPorCuota:+$('pr-seguro').value||0,situacionInicial:situacion,tieneAmortizacion:tieneAmort,historialPrevio:historial,cuotas};
 db.prestamos.push(p);save();cancelarRegistroPrestamo();renderCxp();renderCronograma();renderDashboard();notify('Préstamo registrado correctamente en el centro multifásico')
}

function imprimirRecepcionPrestamoCaptura(){
 const acreedor=creditorName($('pr-acreedor')?.value)||'—',fecha=$('pr-fecha')?.value||today(),referencia=$('pr-referencia')?.value||'—',original=+$('pr-original')?.value||0,cuota=+$('pr-cuota')?.value||0,total=+$('pr-total-cuotas')?.value||0;
 const rows=[...document.querySelectorAll('#pr-amort-body tr')].map((tr,i)=>({numero:tr.querySelector('.pra-num')?.value||i+1,fecha:tr.querySelector('.pra-fecha')?.value||'',capital:+tr.querySelector('.pra-capital')?.value||0,interes:+tr.querySelector('.pra-interes')?.value||0,seguro:+tr.querySelector('.pra-seguro')?.value||0,monto:+tr.querySelector('.pra-cuota')?.value||0}));
 const primera=rows[0];
 const body=`<div class="receipt-head"><h2>RECEPCIÓN DE PRÉSTAMO</h2><div class="receipt-status">${loanSituacion()==='existente'?'Préstamo existente — incorporación con historial previo':'Préstamo nuevo — sin pagos anteriores'}</div></div><div class="box"><table>${row('Fecha de alta',fmtDate(fecha))}${row('Acreedor',acreedor)}${row('Referencia / contrato',referencia)}${row('Monto original','RD$ '+money(original))}${row('Modalidad',$('pr-modalidad')?.value||'—')}${row('Tasa mensual',(+$('pr-tasa-mensual')?.value||0)+' %')}${row('Tasa anual',(+$('pr-tasa-anual')?.value||0)+' %')}${row('Seguro por cuota',(+$('pr-seguro')?.value||0)+' %')}${row('Plazo total',total+' cuotas')}${row('Frecuencia',$('pr-frecuencia')?.value||'—')}${row('Cuota base','RD$ '+money(cuota))}${row('Primera / próxima fecha',fmtDate($('pr-vencimiento')?.value||''))}${row('Tabla de amortización',rows.length?'Generada/cargada':'No cargada')}</table></div>${primera?`<h3>Primera cuota</h3><table><tr><th>Cuota</th><th>Vencimiento</th><th class="r">Capital</th><th class="r">Interés</th><th class="r">Seguro</th><th class="r">Total</th></tr><tr><td>#${primera.numero}</td><td>${fmtDate(primera.fecha)}</td><td class="r">RD$ ${money(primera.capital)}</td><td class="r">RD$ ${money(primera.interes)}</td><td class="r">RD$ ${money(primera.seguro)}</td><td class="r"><b>RD$ ${money(primera.monto)}</b></td></tr></table>`:''}<div class="receipt-signatures"><div><div class="signature"></div><small>Responsable / receptor</small></div><div><div class="signature"></div><small>Acreedor / representante</small></div></div><p class="foot">Documento generado desde el centro de captura multifásico de Moto Repuesto Sandy.</p>`;
 const w=window.open('','_blank');if(!w)return notify('Permite ventanas emergentes para imprimir');w.document.write(`<html><head><meta charset="utf-8"><title>Recepción de préstamo</title><style>@page{size:auto;margin:12mm}body{font-family:Arial,sans-serif;color:#1c2430;padding:20px;max-width:950px;margin:auto}.receipt-head{border-bottom:2px solid #1c2430;padding-bottom:10px;margin-bottom:15px}.receipt-status{font-size:10pt;color:#555}.box{border:1px solid #ccc;padding:10px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}.receipt-signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:55px}.signature{height:45px;border-bottom:1px solid #1c2430;margin-bottom:5px}.foot{margin-top:35px;border-top:1px solid #ccc;padding-top:8px;font-size:9pt;color:#666}@media print{body{padding:0}}</style></head><body>${headerPrint()}${body}</body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},250);
}

function imprimirRecepcionPrestamo(id){
 const p=db.prestamos.find(x=>x.id===id);if(!p)return notify('Préstamo no encontrado');
 const acreedor=creditorName(p.acreedorId), primera=(p.cuotas||[]).find(q=>q.numero===p.proximaCuota)||(p.cuotas||[])[0];
 const situacion=p.situacionInicial==='existente'?'Préstamo existente — incorporado con historial previo':'Préstamo nuevo — sin pagos anteriores';
 const historial=p.historialPrevio?.length?`${p.historialPrevio.length} pago(s) anterior(es)`:'Ninguno';
 const body=`<div class="receipt-head"><h2>RECEPCIÓN DE PRÉSTAMO</h2><div class="receipt-status">${situacion}</div></div>
 <div class="box"><table>
 ${row('No. de préstamo',p.codigo)}${row('Fecha de alta',fmtDate(p.fechaInicio))}${row('Acreedor',acreedor)}${row('Referencia / contrato',p.referenciaContrato||'—')}${row('Monto original','RD$ '+money(p.montoOriginal))}${row('Saldo inicial','RD$ '+money(p.saldo))}
 </table></div>
 <h3>Condiciones pactadas</h3><div class="box"><table>
 ${row('Modalidad',p.modalidad||'—')}${row('Tasa mensual',(p.tasaMensual||0)+' %')}${row('Tasa anual',(p.tasaAnual||0)+' %')}${row('Seguro por cuota',(p.seguroPorCuota||0)+' %')}${row('Plazo total',(p.totalCuotas||0)+' cuotas')}${row('Frecuencia',p.frecuencia||'—')}${row('Cuota base','RD$ '+money(p.cuota))}${row('Próxima cuota','#'+(p.proximaCuota||'—'))}${row('Próximo vencimiento',fmtDate(p.proximoVencimiento)||'—')}${row('Historial previo',historial)}${row('Tabla de amortización',p.tieneAmortizacion?'Sí':'No')}
 </table></div>
 ${primera?`<h3>Primera / próxima cuota registrada</h3><table><tr><th>Cuota</th><th>Vencimiento</th><th class="r">Capital</th><th class="r">Interés</th><th class="r">Seguro</th><th class="r">Total</th></tr><tr><td>#${primera.numero}</td><td>${fmtDate(primera.fecha)}</td><td class="r">RD$ ${money(primera.capital||0)}</td><td class="r">RD$ ${money(primera.interes||0)}</td><td class="r">RD$ ${money(primera.seguro||0)}</td><td class="r"><b>RD$ ${money(primera.montoRestante??primera.monto??0)}</b></td></tr></table>`:''}
 <div class="receipt-signatures"><div><div class="signature"></div><small>Responsable / receptor</small></div><div><div class="signature"></div><small>Acreedor / representante</small></div></div>
 <p class="foot">Documento de recepción y constancia de registro del préstamo en Moto Repuesto Sandy.</p>`;
 const w=window.open('','_blank');if(!w)return notify('Permite ventanas emergentes para imprimir');
 w.document.write(`<html><head><meta charset="utf-8"><title>Recepción de préstamo ${esc(p.codigo)}</title><style>@page{size:auto;margin:12mm}body{font-family:Arial,sans-serif;color:#1c2430;padding:20px;max-width:950px;margin:auto}h1,h2,h3{font-family:Georgia,serif}h2{margin:0 0 6px}.receipt-head{border-bottom:2px solid #1c2430;padding-bottom:10px;margin-bottom:15px}.receipt-status{font-size:10pt;color:#555}.box{border:1px solid #ccc;padding:10px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}.receipt-signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:55px}.signature{height:45px;border-bottom:1px solid #1c2430;margin-bottom:5px}.foot{margin-top:35px;border-top:1px solid #ccc;padding-top:8px;font-size:9pt;color:#666}@media print{body{padding:0}.receipt-signatures{break-inside:avoid}}</style></head><body>${headerPrint()}${printSerial(p.codigo)}${body}</body></html>`);
 w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},250);
}

function addPeriodo(fecha,frecuencia){const d=isoDate(fecha);if(!d)return '';if(frecuencia==='Semanal')d.setDate(d.getDate()+7);else if(frecuencia==='Quincenal')d.setDate(d.getDate()+15);else d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)}
