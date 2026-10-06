/* CxP reportes — estados de cuenta, movimientos de terceros y antigüedad de saldos
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function fillReporteTerceros(prefix){
  const tipo=$(prefix+'-tipo')?.value||'general',sel=$(prefix+'-tercero');if(!sel)return;
  const prev=sel.value;
  let opts='<option value="">Todos</option>';
  if(tipo==='suplidores'||tipo==='general') opts+=db.suplidores.map(s=>`<option value="sup:${s.id}">${s.nombre} — Suplidor</option>`).join('');
  if(tipo==='acreedores'||tipo==='general') opts+=db.acreedores.filter(a=>a.categoria!=='Suplidor').map(a=>`<option value="acr:${a.id}">${a.nombre} — Acreedor</option>`).join('');
  sel.innerHTML=opts;
  // Asignar un valor que no existe entre las opciones deja value en '' por sí solo,
  // así que no hace falta recorrer sel.options.
  if(prev)sel.value=prev;
}

function fillCxpReportAcreedores(){
  fillReporteTerceros('ec');fillReporteTerceros('ag');
  const d=today();
  if($('ec-hasta'))$('ec-hasta').value=d;
  if($('ec-corte'))$('ec-corte').value=d;
  if($('ag-corte'))$('ag-corte').value=d;
  toggleEstadoCuenta();
}

function clearEstadoCuentaResultado(){
  const box=$('estado-cuenta-cxp-contenido');
  if(box)box.innerHTML='<div class="empty">Define los filtros y pulsa «Consultar estado».</div>';
}

function toggleEstadoCuenta(){
  const modo=$('ec-modo')?.value||'rango',rango=modo==='rango';
  if($('ec-desde'))$('ec-desde').disabled=!rango;
  if($('ec-hasta'))$('ec-hasta').disabled=!rango;
  if($('ec-corte'))$('ec-corte').disabled=rango;
}

function resetEstadoCuentaCxp(){
  if($('ec-tipo'))$('ec-tipo').value='general';
  if($('ec-modo'))$('ec-modo').value='rango';
  if($('ec-formato'))$('ec-formato').value='detallado';
  if($('ec-desde'))$('ec-desde').value='';
  if($('ec-hasta'))$('ec-hasta').value=today();
  if($('ec-corte'))$('ec-corte').value=today();
  fillReporteTerceros('ec');
  if($('ec-tercero'))$('ec-tercero').value='';
  toggleEstadoCuenta();
  clearEstadoCuentaResultado();
}

function resetAntiguedadCxp(){if($('ag-tipo'))$('ag-tipo').value='general';if($('ag-corte'))$('ag-corte').value=today();fillReporteTerceros('ag');if($('ag-tercero'))$('ag-tercero').value='';$('tbl-cxp-antiguedad-general').innerHTML='<tr><td colspan="7" class="empty">Selecciona los filtros y analiza los saldos.</td></tr>';$('tfoot-cxp-antiguedad-general').innerHTML='';}

function selectedReportEntities(prefix){
  const tipo=$(prefix+'-tipo')?.value||'general',sel=$(prefix+'-tercero')?.value||'';
  const entities=[];
  if(sel.startsWith('sup:')){const id=sel.slice(4),s=db.suplidores.find(x=>x.id===id);if(s)entities.push({kind:'sup',id:s.id,acreedorId:s.acreedorId,nombre:s.nombre,categoria:'Suplidor'});}
  else if(sel.startsWith('acr:')){const id=sel.slice(4),a=creditorById(id);if(a)entities.push({kind:'acr',id:a.id,acreedorId:a.id,nombre:a.nombre,categoria:a.categoria});}
  else{
    if(tipo==='suplidores'||tipo==='general')db.suplidores.forEach(s=>entities.push({kind:'sup',id:s.id,acreedorId:s.acreedorId,nombre:s.nombre,categoria:'Suplidor'}));
    if(tipo==='acreedores'||tipo==='general')db.acreedores.filter(a=>a.categoria!=='Suplidor').forEach(a=>entities.push({kind:'acr',id:a.id,acreedorId:a.id,nombre:a.nombre,categoria:a.categoria}));
  }
  return entities;
}

function reportMovimientosTercero(e){
  if(e.kind==='sup'){
    const mov=[];
    db.facturasSuplidor.filter(f=>f.suplidorId===e.id).forEach(f=>mov.push({fecha:f.fecha,tipo:'Factura de mercancía',ref:f.documento||f.codigo,cargo:Number(f.total||0),abono:0,origen:'Mercancía',esFactura:true,vencimiento:f.vencimiento}));
    db.pagosSuplidor.filter(p=>p.suplidorId===e.id).forEach(p=>(p.aplicaciones||[]).forEach(a=>{const f=db.facturasSuplidor.find(x=>x.id===a.facturaId);if(f)mov.push({fecha:p.fecha,tipo:'Pago a suplidor',ref:p.codigo+' / '+(f.documento||f.codigo),cargo:0,abono:Number(a.aplicado||0),origen:'Mercancía'});}));
    return mov.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')||(a.ref||'').localeCompare(b.ref||''));
  }
  return reportMovimientosAcreedor(e.acreedorId).filter(m=>m.origen!=='Mercancía');
}

function fechaAnterior(fecha){
  if(!fecha)return '';
  const d=isoDate(fecha);
  d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}

function reportMovimientosAcreedor(acreedorId){
  const mov=[];
  // En el estado de cuenta solo deben aparecer GO que continúan pendientes.
  // La obligación OB queda como vínculo técnico interno; nunca es la referencia visible.
  // Si el GO ya fue pagado (saldo de la obligación en cero), se excluye por completo
  // del estado de cuenta: no mostramos ni el cargo original ni sus pagos.
  const obligacionesGO=new Set();
  db.obligaciones.filter(o=>o.acreedorId===acreedorId&&Number(o.saldo||0)>.004&&obligacionVigente(o)).forEach(o=>{
    const gastoVinculado=o.gastoId?db.gastos.find(g=>g.id===o.gastoId):null;
    if(!gastoVinculado||gastoVinculado.estado!=='Pendiente')return;
    obligacionesGO.add(o.id);
    mov.push({fecha:o.fecha,tipo:gastoVinculado.categoria||o.tipo||'Gasto operacional',ref:gastoVinculado.codigo,cargo:Number(o.monto||0),abono:0,origen:'Gasto operacional',esObligacion:true,vencimiento:o.vencimiento||gastoVinculado.vencimiento||null});
  });
  db.pagosObligaciones.forEach(p=>{
    const o=db.obligaciones.find(x=>x.id===p.obligacionId);
    if(o&&o.acreedorId===acreedorId&&obligacionesGO.has(o.id)){
      mov.push({fecha:p.fecha,tipo:'Pago de gasto',ref:p.codigo,cargo:0,abono:Number(p.monto||0),origen:'Gasto operacional'});
    }
  });
  db.prestamos.filter(p=>p.acreedorId===acreedorId).forEach(p=>{
    const original=Number(p.montoOriginal||p.saldo||0);
    const inicial=Number(p.pagosIniciales||0);
    mov.push({fecha:p.fechaInicio,tipo:'Préstamo / financiamiento',ref:p.codigo,cargo:original,abono:0,origen:'Préstamo'});

    // El registro del préstamo puede conservar el saldo y las cuotas aun cuando
    // los comprobantes individuales de pagos anteriores no estén en pagosPrestamos.
    // En ese caso reflejamos el historial implícito para que el estado de cuenta
    // siga la misma cadena que muestra el préstamo.
    if(inicial>.004){
      const hist=Array.isArray(p.historialPrevio)?p.historialPrevio:[];
      if(hist.length){
        hist.forEach((h,i)=>{const cap=Number(h.capital||0);if(cap>.004)mov.push({fecha:h.fecha||p.fechaInicio,tipo:'Pago anterior',ref:h.referencia||(`${p.codigo} / anterior ${i+1}`),cargo:0,abono:cap,origen:'Préstamo'});});
      }else{
        mov.push({fecha:p.fechaInicio,tipo:'Pago inicial',ref:p.codigo+' / inicial',cargo:0,abono:inicial,origen:'Préstamo'});
      }
    }

    const reales=db.pagosPrestamos.filter(pg=>pg.prestamoId===p.id&&pagoPrestamoActivo(pg));
    const saldoActual=Math.max(0,Number(p.saldo||0));
    const totalReal=reales.reduce((z,pg)=>z+Number(pg.monto||0),0);

    // El saldo guardado en el préstamo es la fuente de verdad del estado de cuenta.
    // Si existen comprobantes reales, se muestran individualmente y el importe que
    // falta para reconciliar el saldo actual se conserva como historial anterior.
    // Esto permite que un pago reciente (por ejemplo RD$6,000) reduzca el saldo
    // sin perder los pagos históricos que no tienen comprobante individual.
    if(reales.length){
      reales.forEach(pg=>mov.push({fecha:pg.fecha,tipo:'Pago de préstamo',ref:pg.codigo,cargo:0,abono:Number(pg.monto||0),origen:'Préstamo'}));
      const historico=Math.max(0,Math.round((original-inicial-totalReal-saldoActual)*100)/100);
      if(historico>.004){
        mov.push({fecha:p.fechaInicio||today(),tipo:'Pagos anteriores',ref:p.codigo+' / historial',cargo:0,abono:historico,origen:'Préstamo'});
      }
    }else{
      const totalPagadoTeorico=Math.max(0,Math.round((original-inicial-saldoActual)*100)/100);
      if(totalPagadoTeorico>.004){
        // Si faltan comprobantes, separamos las cuotas que el calendario marca
        // como pagadas y dejamos el resto como pagos anteriores.
        const pagadasCalendario=(p.cuotas||[]).filter(q=>q.estado==='Pagada');
        const pagadoCalendario=pagadasCalendario.reduce((z,q)=>z+Number(q.monto||0),0);
        const anteriores=Math.max(0,Math.round((totalPagadoTeorico-pagadoCalendario)*100)/100);
        if(anteriores>.004){
          const fechaAnteriorPago=p.fechaInicio||today();
          mov.push({fecha:fechaAnteriorPago,tipo:'Pagos anteriores',ref:p.codigo+' / historial',cargo:0,abono:anteriores,origen:'Préstamo'});
        }
        pagadasCalendario.forEach(q=>{
          const montoCuota=Number(q.monto||0);
          if(montoCuota>.004)mov.push({fecha:q.fecha||p.fechaInicio,tipo:'Pago de cuota',ref:p.codigo+' / cuota '+q.numero,cargo:0,abono:montoCuota,origen:'Préstamo'});
        });
      }
    }
  });
  return mov.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')||(a.ref||'').localeCompare(b.ref||''));
}

function buildEstadoCuentaTercero(e,desde,hasta){
  const mov=reportMovimientosTercero(e).filter(m=>m&&((m.fecha||hasta)));
  const inicio=desde?fechaAnterior(desde):null;
  const apertura=inicio?mov.filter(m=>m.fecha<=inicio).reduce((z,m)=>z+m.cargo-m.abono,0):0;
  const lista=mov.filter(m=>m.fecha<=hasta&&(!desde||m.fecha>=desde));
  let saldo=apertura;
  const totalC=lista.reduce((z,m)=>z+m.cargo,0),totalA=lista.reduce((z,m)=>z+m.abono,0);
  const rows=lista.map(m=>{
    saldo+=m.cargo-m.abono;
    let diasVencidos='—';
    if(m.vencimiento){
      const dias=diasVencidosFirmados(m.vencimiento,hasta);
      const vencida=dias>0;
      diasVencidos=`<span class="days-status ${vencida?'red':'green'}">${dias} ${Math.abs(dias)===1?'día':'días'}</span>`;
    }
    return `<tr><td>${fmtDate(m.fecha)}</td><td>${m.tipo}</td><td>${m.ref}</td><td>${diasVencidos}</td><td class="r">${m.cargo?money(m.cargo):'—'}</td><td class="r">${m.abono?money(m.abono):'—'}</td><td class="r"><b>${money(saldo)}</b></td></tr>`;
  }).join('');
  return {mov,apertura,lista,saldo,totalC,totalA,rows};
}

function consultarEstadoCuentaCxp(){
  const box=$('estado-cuenta-cxp-contenido');
  if(!box)return;
  try{
    // Normalizamos las colecciones para que un dato antiguo o incompleto no bloquee la consulta.
    db.suplidores=Array.isArray(db.suplidores)?db.suplidores:[];
    db.acreedores=Array.isArray(db.acreedores)?db.acreedores:[];
    db.facturasSuplidor=Array.isArray(db.facturasSuplidor)?db.facturasSuplidor:[];
    db.pagosSuplidor=Array.isArray(db.pagosSuplidor)?db.pagosSuplidor:[];
    db.obligaciones=Array.isArray(db.obligaciones)?db.obligaciones:[];
    db.pagosObligaciones=Array.isArray(db.pagosObligaciones)?db.pagosObligaciones:[];
    db.prestamos=Array.isArray(db.prestamos)?db.prestamos:[];
    db.pagosPrestamos=Array.isArray(db.pagosPrestamos)?db.pagosPrestamos:[];

    const modo=$('ec-modo')?.value||'rango';
    const entities=selectedReportEntities('ec');
    if(!entities.length){
      box.innerHTML='<div class="empty">No hay terceros para el tipo seleccionado.</div>';
      return;
    }

    const formato=$('ec-formato')?.value||'detallado';
    let desde='',hasta='';
    if(modo==='corte'){
      hasta=$('ec-corte')?.value||today();
    }else{
      desde=$('ec-desde')?.value||'';
      hasta=$('ec-hasta')?.value||today();
      // Si no se indicó Desde, interpretamos la consulta como "desde el inicio".
      // Esto evita que el botón parezca no responder por un campo opcional vacío.
      if(desde&&hasta&&desde>hasta){
        box.innerHTML='<div class="empty">La fecha Desde no puede ser posterior a Hasta.</div>';
        return;
      }
    }

    const multi=entities.length>1;
    const titulo=entities.length===1?entities[0].nombre:'Todos los terceros seleccionados';
    let html=`<h2 style="font-family:Georgia,serif;font-weight:400;font-size:1.05rem;margin-top:0">Estado de cuenta — ${esc(titulo)}</h2><p><b>Tipo:</b> ${$('ec-tipo')?.selectedOptions?.[0]?.text||'General'} &nbsp; <b>Consulta:</b> ${modo==='corte'?'Al día':'Entre fechas'} &nbsp; <b>Formato:</b> ${formato==='resumido'?'Resumido':'Detallado'} &nbsp; <b>Período:</b> ${desde?fmtDate(desde)+' al ': 'Hasta '} ${fmtDate(hasta)}</p>`;

    if(formato==='resumido'){
      let totalApertura=0,totalC=0,totalA=0,totalSaldo=0;
      html+='<div class="card" style="padding:10px"><table><thead><tr><th>Suplidor / acreedor</th><th>Tipo</th><th class="r">Saldo anterior</th><th class="r">Cargos</th><th class="r">Abonos</th><th class="r">Saldo al corte</th></tr></thead><tbody>';
      entities.forEach(e=>{
        const r=buildEstadoCuentaTercero(e,desde,hasta);
        totalApertura+=r.apertura; totalC+=r.totalC; totalA+=r.totalA; totalSaldo+=r.saldo;
        html+=`<tr><td>${esc(e.nombre)}</td><td>${esc(e.categoria||'')}</td><td class="r">${money(r.apertura)}</td><td class="r">${money(r.totalC)}</td><td class="r">${money(r.totalA)}</td><td class="r"><b>${money(r.saldo)}</b></td></tr>`;
      });
      html+=`</tbody><tfoot><tr class="report-total-row"><td colspan="2">TOTALES</td><td class="r">${money(totalApertura)}</td><td class="r">${money(totalC)}</td><td class="r">${money(totalA)}</td><td class="r">${money(totalSaldo)}</td></tr></tfoot></table></div>`;
      html+=`<div class="report-summary"><div>Saldo anterior<b>${money(totalApertura)}</b></div><div>Cargos<b>${money(totalC)}</b></div><div>Abonos<b>${money(totalA)}</b></div><div>Saldo al corte<b>${money(totalSaldo)}</b></div></div>`;
    }else if(multi){
      let globalC=0,globalA=0,globalSaldo=0;
      html+='<div class="report-groups">';
      entities.forEach(e=>{
        const r=buildEstadoCuentaTercero(e,desde,hasta);
        globalC+=r.totalC;globalA+=r.totalA;globalSaldo+=r.saldo;
        html+=`<div class="card report-third-party"><h3 style="margin-top:0">${esc(e.nombre)} <small>(${esc(e.categoria||'')})</small></h3><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th>Días vencidos</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody><tr><td colspan="6"><b>Saldo anterior</b></td><td class="r"><b>${money(r.apertura)}</b></td></tr>${r.rows||'<tr><td colspan="7" class="empty">No hay movimientos en el período.</td></tr>'}</tbody><tfoot><tr class="report-total-row"><td colspan="4">TOTALES</td><td class="r">${money(r.totalC)}</td><td class="r">${money(r.totalA)}</td><td class="r">${money(r.saldo)}</td></tr></tfoot></table></div>`;
      });
      html+='</div>';
      html+=`<div class="report-summary"><div>Cargos generales<b>${money(globalC)}</b></div><div>Abonos generales<b>${money(globalA)}</b></div><div>Saldo general<b>${money(globalSaldo)}</b></div></div>`;
    }else{
      const r=buildEstadoCuentaTercero(entities[0],desde,hasta);
      html+=`<table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th>Días vencidos</th><th class="r">Cargo</th><th class="r">Abono</th><th class="r">Saldo</th></tr></thead><tbody><tr><td colspan="6"><b>Saldo anterior</b></td><td class="r"><b>${money(r.apertura)}</b></td></tr>${r.rows||'<tr><td colspan="7" class="empty">No hay movimientos en el período.</td></tr>'}</tbody><tfoot><tr class="report-total-row"><td colspan="4">TOTALES DEL PERÍODO</td><td class="r">${money(r.totalC)}</td><td class="r">${money(r.totalA)}</td><td class="r">${money(r.saldo)}</td></tr></tfoot></table><div class="report-summary"><div>Saldo anterior<b>${money(r.apertura)}</b></div><div>Cargos<b>${money(r.totalC)}</b></div><div>Abonos<b>${money(r.totalA)}</b></div><div>Saldo al corte<b>${money(r.saldo)}</b></div></div>`;
    }
    box.innerHTML=html;
  }catch(err){
    console.error('Estado de cuenta:',err);
    box.innerHTML=`<div class="empty">No fue posible generar el estado de cuenta. ${esc(err?.message||'Revise los datos registrados.')}</div>`;
  }
}

// Compatibilidad con versiones anteriores que llamen directamente esta función.
function renderEstadoCuentaCxp(){consultarEstadoCuentaCxp();}

function bucketAntiguedad(dias,monto,b){if(monto<=.004)return;if(dias<=0)b[0]+=monto;else if(dias<=30)b[1]+=monto;else if(dias<=60)b[2]+=monto;else if(dias<=90)b[3]+=monto;else b[4]+=monto;}

function renderAntiguedadCxp(){
  const corte=$('ag-corte')?.value||today(),tb=$('tbl-cxp-antiguedad-general'),tf=$('tfoot-cxp-antiguedad-general'),entities=selectedReportEntities('ag');if(!tb)return;
  const rows=[];entities.forEach(e=>{const b=[0,0,0,0,0];
    if(e.kind==='sup'){
      db.facturasSuplidor.filter(f=>f.suplidorId===e.id&&f.fecha<=corte).forEach(f=>{const pagos=db.pagosSuplidor.filter(p=>p.suplidorId===e.id&&p.fecha<=corte).reduce((z,p)=>z+(p.aplicaciones||[]).filter(ap=>ap.facturaId===f.id).reduce((q,ap)=>q+Number(ap.aplicado||0),0),0);const saldo=Math.max(0,Number(f.total||0)-pagos);bucketAntiguedad(Math.floor((isoDate(corte)-isoDate(f.vencimiento))/86400000),saldo,b)});
    }else{
      db.obligaciones.filter(o=>o.acreedorId===e.id&&obligacionVigente(o)&&o.fecha<=corte).forEach(o=>{const pagos=db.pagosObligaciones.filter(p=>p.obligacionId===o.id&&p.fecha<=corte).reduce((z,p)=>z+Number(p.monto||0),0);const saldo=Math.max(0,Number(o.monto||0)-pagos);bucketAntiguedad(Math.floor((isoDate(corte)-isoDate(o.vencimiento||o.fecha))/86400000),saldo,b)});
      db.prestamos.filter(p=>p.acreedorId===e.id).forEach(p=>{
        // El estado de cuenta utiliza el saldo global del préstamo como fuente de verdad.
        // Antigüedad debe partir del mismo saldo al corte para no volver a calcularlo
        // únicamente desde los comprobantes recientes y omitir pagos históricos.
        let remaining=Number(balanceAsOfLoan(p,corte)||0);
        if(remaining<=.004)return;

        // Distribuimos primero el saldo entre las cuotas pendientes vencidas/al día
        // que ya forman parte del calendario al corte. Cualquier saldo restante
        // corresponde a capital/cuotas futuras y se presenta como corriente.
        const pendientes=(p.cuotas||[])
          .filter(q=>q.estado!=='Pagada'&&q.fecha<=corte)
          .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')||Number(a.numero||0)-Number(b.numero||0));
        pendientes.forEach(q=>{
          if(remaining<=.004)return;
          const amt=Math.min(remaining,Number(q.montoRestante??q.monto??0));
          if(amt>.004){
            bucketAntiguedad(Math.floor((isoDate(corte)-isoDate(q.fecha))/86400000),amt,b);
            remaining=Math.max(0,Math.round((remaining-amt)*100)/100);
          }
        });
        if(remaining>.004)bucketAntiguedad(0,remaining,b);
      });
    }
    const total=b.reduce((z,v)=>z+v,0);if(total>.004)rows.push({a:e,b,total});
  });
  tb.innerHTML=rows.length?rows.map(r=>`<tr>${r.a.nombre?`<td>${esc(r.a.nombre)} <small>(${esc(r.a.categoria)})</small></td>`:`<td><small>(${esc(r.a.categoria)})</small></td>`}${r.b.map(v=>`<td class="r">${money(v)}</td>`).join('')}<td class="r"><b>${money(r.total)}</b></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No hay saldos pendientes al corte.</td></tr>';
  const t=[0,0,0,0,0];rows.forEach(r=>r.b.forEach((v,i)=>t[i]+=v));const total=t.reduce((z,v)=>z+v,0);tf.innerHTML=`<tr class="report-total-row"><td>TOTALES GENERALES</td>${t.map(v=>`<td class="r">${money(v)}</td>`).join('')}<td class="r">${money(total)}</td></tr>`;
}
