/* Cambios intencionales respecto al monolito de original/.
 *
 * El verificador de build.js comparaba los módulos contra el archivo original
 * línea por línea para demostrar que la separación de módulos no perdió código.
 * Esa comparación ya no puede ser literal: esta Fase 0 corrige bugs a propósito.
 *
 * En vez de desactivar el control, cada diferencia deliberada queda registrada aquí.
 * El verificador sigue fallando ante cualquier cambio que NO esté en esta lista.
 *
 * Generado a partir de `git diff -U0`. No editar a mano.
 */

module.exports = {
  cambios: [
    {
      archivo: "index.html",
      motivo: "Quita el nombre de una persona real que estaba en el placeholder del formulario de empleados.",
      quita: [
        "    <div><label>Nombre completo</label><input id=\"emp-nombre\" placeholder=\"Ej. Antonio de Jes\u00fas\"></div>",
      ],
      agrega: [
        "    <div><label>Nombre completo</label><input id=\"emp-nombre\" placeholder=\"Nombre y apellidos\"></div>",
      ],
    },
    {
      archivo: "js/dominio/acreedores.js",
      motivo: "Escapa con esc() los nombres y categor\u00edas de acreedores en los <option> generados.",
      quita: [
        "function fillAcreedores(){const all=db.acreedores.map(a=>`<option value=\"${a.id}\">${a.nombre} \u2014 ${a.categoria}</option>`).join('');['pr-acreedor','ga-acreedor'].forEach(id=>{if($(id))$(id).innerHTML='<option value=\"\">Seleccione...</option>'+all});const sups=db.suplidores.map(s=>`<option value=\"${s.id}\">${s.nombre}</option>`).join('');$('fx-sp').innerHTML='<option value=\"\">Seleccione...</option>'+sups;const filtroSup=$('fx-tercero');if(filtroSup){const previo=filtroSup.value;filtroSup.innerHTML='<option value=\"\">Todos los suplidores</option>'+db.suplidores.map(s=>`<option value=\"sup:${s.id}\">${s.codigo?s.codigo+' \u2014 ':''}${esc(s.nombre)}</option>`).join('');if(previo&&db.suplidores.some(s=>('sup:'+s.id)===previo))filtroSup.value=previo;}$('pg-sp').innerHTML='<option value=\"\">Seleccione...</option>'+sups;const sid=$('fx-tercero-id')?.value?.replace(/^sup:/,'');if(sid&&!db.suplidores.some(s=>s.id===sid)){if($('fx-tercero-id'))$('fx-tercero-id').value='';if($('fx-tercero'))$('fx-tercero').value='';}const ps=db.prestamos.map(p=>`<option value=\"${p.id}\">${creditorName(p.acreedorId)} \u2014 ${money(p.saldo)} pendiente</option>`).join('');$('prp-prestamo').innerHTML='<option value=\"\">Seleccione...</option>'+ps;const obs=db.obligaciones.filter(o=>o.saldo>.004&&obligacionVigente(o)).map(o=>`<option value=\"${o.id}\">${creditorName(o.acreedorId)} \u2014 ${o.descripcion||o.tipo} \u2014 ${money(o.saldo)}</option>`).join('');$('obp-obligacion').innerHTML='<option value=\"\">Seleccione...</option>'+obs}",
      ],
      agrega: [
        "function fillAcreedores(){const all=db.acreedores.map(a=>`<option value=\"${esc(a.id)}\">${esc(a.nombre)} \u2014 ${esc(a.categoria)}</option>`).join('');['pr-acreedor','ga-acreedor'].forEach(id=>{if($(id))$(id).innerHTML='<option value=\"\">Seleccione...</option>'+all});const sups=db.suplidores.map(s=>`<option value=\"${esc(s.id)}\">${esc(s.nombre)}</option>`).join('');$('fx-sp').innerHTML='<option value=\"\">Seleccione...</option>'+sups;const filtroSup=$('fx-tercero');if(filtroSup){const previo=filtroSup.value;filtroSup.innerHTML='<option value=\"\">Todos los suplidores</option>'+db.suplidores.map(s=>`<option value=\"sup:${esc(s.id)}\">${s.codigo?s.codigo+' \u2014 ':''}${esc(s.nombre)}</option>`).join('');if(previo&&db.suplidores.some(s=>('sup:'+s.id)===previo))filtroSup.value=previo;}$('pg-sp').innerHTML='<option value=\"\">Seleccione...</option>'+sups;const sid=$('fx-tercero-id')?.value?.replace(/^sup:/,'');if(sid&&!db.suplidores.some(s=>s.id===sid)){if($('fx-tercero-id'))$('fx-tercero-id').value='';if($('fx-tercero'))$('fx-tercero').value='';}const ps=db.prestamos.map(p=>`<option value=\"${esc(p.id)}\">${esc(creditorName(p.acreedorId))} \u2014 ${money(p.saldo)} pendiente</option>`).join('');$('prp-prestamo').innerHTML='<option value=\"\">Seleccione...</option>'+ps;const obs=db.obligaciones.filter(o=>o.saldo>.004&&obligacionVigente(o)).map(o=>`<option value=\"${esc(o.id)}\">${esc(creditorName(o.acreedorId))} \u2014 ${esc(o.descripcion||o.tipo)} \u2014 ${money(o.saldo)}</option>`).join('');$('obp-obligacion').innerHTML='<option value=\"\">Seleccione...</option>'+obs}",
      ],
    },
    {
      archivo: "js/dominio/cxp-reportes.js",
      motivo: "Escapa nombre y categor\u00eda del acreedor en el reporte de saldos. Evita recorrer sel.options para validar la selecci\u00f3n.",
      quita: [
        "  if([...sel.options].some(o=>o.value===prev))sel.value=prev;",
      ],
      agrega: [
        "  // Asignar un valor que no existe entre las opciones deja value en '' por s\u00ed solo,",
        "  // as\u00ed que no hace falta recorrer sel.options.",
        "  if(prev)sel.value=prev;",
      ],
    },
    {
      archivo: "js/dominio/cxp-reportes.js",
      motivo: "Escapa nombre y categor\u00eda del acreedor en el reporte de saldos. Evita recorrer sel.options para validar la selecci\u00f3n.",
      quita: [
        "  tb.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.a.nombre} <small>(${r.a.categoria})</small></td>${r.b.map(v=>`<td class=\"r\">${money(v)}</td>`).join('')}<td class=\"r\"><b>${money(r.total)}</b></td></tr>`).join(''):'<tr><td colspan=\"7\" class=\"empty\">No hay saldos pendientes al corte.</td></tr>';",
      ],
      agrega: [
        "  tb.innerHTML=rows.length?rows.map(r=>`<tr>${r.a.nombre?`<td>${esc(r.a.nombre)} <small>(${esc(r.a.categoria)})</small></td>`:`<td><small>(${esc(r.a.categoria)})</small></td>`}${r.b.map(v=>`<td class=\"r\">${money(v)}</td>`).join('')}<td class=\"r\"><b>${money(r.total)}</b></td></tr>`).join(''):'<tr><td colspan=\"7\" class=\"empty\">No hay saldos pendientes al corte.</td></tr>';",
      ],
    },
    {
      archivo: "js/dominio/cxp.js",
      motivo: "Define fillCxpTerceros(), que renderCxp() invocaba sin existir y truncaba todo el arranque. A\u00f1adeUDE los acreedores no proveedores al filtro de terceros y escapa nombre, tipo y documento de las tablas.",
      quita: [
      ],
      agrega: [
        "// Selector de terceros del filtro de CxP. El original la llamaba sin haberla definido,",
        "// y como renderCxp() la invoca al final, su ausencia truncaba todo el arranque y las",
        "// 23 llamadas a renderCxp(). Adem\u00e1s fillAcreedores() solo inyecta suplidores, as\u00ed que",
        "// aqu\u00ed se completan los acreedores (obligaciones y pr\u00e9stamos) con el prefijo acr: que",
        "// renderCxp() ya sabe interpretar.",
        "function fillCxpTerceros(){",
        "  const sel=$('fx-tercero');if(!sel)return;",
        "  const oculto=$('fx-tercero-id'),previo=sel.value||oculto?.value||'';",
        "  const orden=(a,b)=>(a.codigo||'').localeCompare(b.codigo||'',undefined,{numeric:true})||a.nombre.localeCompare(b.nombre);",
        "  const sups=db.suplidores.slice().sort(orden);",
        "  const acrs=db.acreedores.filter(a=>a.categoria!=='Suplidor').slice().sort(orden);",
        "  sel.innerHTML=['<option value=\"\">Todos los terceros</option>',",
        "    ...sups.map(s=>`<option value=\"sup:${s.id}\">${s.codigo?s.codigo+' \u2014 ':''}${esc(s.nombre)} (Suplidor)</option>`),",
        "    ...acrs.map(a=>`<option value=\"acr:${a.id}\">${a.codigo?a.codigo+' \u2014 ':''}${esc(a.nombre)} (${esc(a.categoria)})</option>`)].join('');",
        "// Si el valor previo ya no corresponde a ninguna opci\u00f3n, el navegador normaliza",
        "// value a '' por s\u00ed solo al asignarlo; no hace falta leer sel.options.",
        "sel.value=previo;",
        "if(oculto)oculto.value=sel.value;",
        "}",
        "",
      ],
    },
    {
      archivo: "js/dominio/cxp.js",
      motivo: "Define fillCxpTerceros(), que renderCxp() invocaba sin existir y truncaba todo el arranque. A\u00f1adeUDE los acreedores no proveedores al filtro de terceros y escapa nombre, tipo y documento de las tablas.",
      quita: [
        " $('tbl-facturas-cxp').innerHTML=rows.length?rows.map(x=>`<tr><td>${x.codigo}</td><td>${x.tipo}</td><td>${x.nombre}</td><td>${x.documento}</td><td>${fmtDate(x.fecha)}</td><td>${fmtDate(x.vencimiento)}</td>${daysCell(x)}<td class=\"r\">${money(x.total)}</td><td class=\"r\">${money(x.saldo)}</td><td><span class=\"pill ${x.estado==='Vencida'?'red':x.estado==='Pagada'?'green':'yellow'}\">${x.estado||'Pendiente'}</span></td><td class=\"no-print action-cell\">${x.kind==='factura'?`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('factura','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('factura','${x.id}')\">Imprimir</button></div>`:x.kind==='obligacion'?`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('obligacion','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('obligacion','${x.id}')\">Imprimir</button></div>`:`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"printRecord('prestamo','${x.id.split('-')[0]}')\">Imprimir</button></div>`}</td></tr>`).join(''):'<tr><td colspan=\"11\" class=\"empty\">No hay cuentas por pagar con los filtros seleccionados.</td></tr>';",
      ],
      agrega: [
        " $('tbl-facturas-cxp').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${esc(x.tipo)}</td><td>${esc(x.nombre)}</td><td>${esc(x.documento)}</td><td>${fmtDate(x.fecha)}</td><td>${fmtDate(x.vencimiento)}</td>${daysCell(x)}<td class=\"r\">${money(x.total)}</td><td class=\"r\">${money(x.saldo)}</td><td><span class=\"pill ${x.estado==='Vencida'?'red':x.estado==='Pagada'?'green':'yellow'}\">${esc(x.estado||'Pendiente')}</span></td><td class=\"no-print action-cell\">${x.kind==='factura'?`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('factura','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('factura','${x.id}')\">Imprimir</button></div>`:x.kind==='obligacion'?`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('obligacion','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('obligacion','${x.id}')\">Imprimir</button></div>`:`<div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"printRecord('prestamo','${x.id.split('-')[0]}')\">Imprimir</button></div>`}</td></tr>`).join(''):'<tr><td colspan=\"11\" class=\"empty\">No hay cuentas por pagar con los filtros seleccionados.</td></tr>';",
      ],
    },
    {
      archivo: "js/dominio/cxp.js",
      motivo: "Define fillCxpTerceros(), que renderCxp() invocaba sin existir y truncaba todo el arranque. A\u00f1adeUDE los acreedores no proveedores al filtro de terceros y escapa nombre, tipo y documento de las tablas.",
      quita: [
        " $('tbl-acreedores').innerHTML=db.acreedores.length?db.acreedores.map(a=>{const bs=db.facturasSuplidor.filter(f=>(f.acreedorId===a.id||db.suplidores.some(s=>s.id===f.suplidorId&&s.acreedorId===a.id))).reduce((z,f)=>z+Number(f.saldo||0),0);const bo=db.obligaciones.filter(o=>o.acreedorId===a.id&&obligacionVigente(o)).reduce((z,o)=>z+Number(o.saldo||0),0);const bp=db.prestamos.filter(p=>p.acreedorId===a.id).reduce((z,p)=>z+Number(p.saldo||0),0);return `<tr><td>${a.codigo}</td><td>${a.nombre}</td><td>${a.categoria}</td><td>${a.rnc||'\u2014'}</td><td class=\"r\">${money(bs+bo+bp)}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('acreedor','${a.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('acreedor','${a.id}')\">Imprimir</button></div></td></tr>`}).join(''):'<tr><td colspan=\"6\" class=\"empty\">Sin acreedores.</td></tr>';",
        " $('tbl-prestamos').innerHTML=db.prestamos.length?db.prestamos.map(p=>{const original=Number(p.montoOriginal||0);const saldo=Number(p.saldo||0);const progreso=original>0?Math.min(100,Math.max(0,((original-saldo)/original)*100)):0;return `<tr><td>${p.codigo}</td><td>${creditorName(p.acreedorId)}</td><td class=\"r\">${money(p.saldo)}</td><td>${money(p.cuota)}</td><td>#${p.proximaCuota||'\u2014'}/${p.totalCuotas}</td><td>${fmtDate(p.proximoVencimiento)}</td><td>${progreso.toFixed(2)}%</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('prestamo','${p.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"imprimirRecepcionPrestamo('${p.id}')\">Recepci\u00f3n</button><button class=\"btn secondary\" onclick=\"printRecord('prestamo','${p.id}')\">Calendario</button></div></td></tr>`}).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin pr\u00e9stamos registrados.</td></tr>';",
      ],
      agrega: [
        " $('tbl-acreedores').innerHTML=db.acreedores.length?db.acreedores.map(a=>{const bs=db.facturasSuplidor.filter(f=>(f.acreedorId===a.id||db.suplidores.some(s=>s.id===f.suplidorId&&s.acreedorId===a.id))).reduce((z,f)=>z+Number(f.saldo||0),0);const bo=db.obligaciones.filter(o=>o.acreedorId===a.id&&obligacionVigente(o)).reduce((z,o)=>z+Number(o.saldo||0),0);const bp=db.prestamos.filter(p=>p.acreedorId===a.id).reduce((z,p)=>z+Number(p.saldo||0),0);return `<tr><td>${esc(a.codigo)}</td><td>${esc(a.nombre)}</td><td>${esc(a.categoria)}</td><td>${esc(a.rnc||'\u2014')}</td><td class=\"r\">${money(bs+bo+bp)}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('acreedor','${a.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('acreedor','${a.id}')\">Imprimir</button></div></td></tr>`}).join(''):'<tr><td colspan=\"6\" class=\"empty\">Sin acreedores.</td></tr>';",
        " $('tbl-prestamos').innerHTML=db.prestamos.length?db.prestamos.map(p=>{const original=Number(p.montoOriginal||0);const saldo=Number(p.saldo||0);const progreso=original>0?Math.min(100,Math.max(0,((original-saldo)/original)*100)):0;return `<tr><td>${esc(p.codigo)}</td><td>${esc(creditorName(p.acreedorId))}</td><td class=\"r\">${money(p.saldo)}</td><td>${money(p.cuota)}</td><td>#${p.proximaCuota||'\u2014'}/${p.totalCuotas}</td><td>${fmtDate(p.proximoVencimiento)}</td><td>${progreso.toFixed(2)}%</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('prestamo','${p.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"imprimirRecepcionPrestamo('${p.id}')\">Recepci\u00f3n</button><button class=\"btn secondary\" onclick=\"printRecord('prestamo','${p.id}')\">Calendario</button></div></td></tr>`}).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin pr\u00e9stamos registrados.</td></tr>';",
      ],
    },
    {
      archivo: "js/dominio/empresa.js",
      motivo: "Escapa los datos de empresa en la ficha y en la marca de la cabecera.",
      quita: [
        "function renderEmpresa(){$('em-nombre').value=db.empresa.nombre||'';$('em-rnc').value=db.empresa.rnc||'';$('em-tel').value=db.empresa.tel||'';$('em-email').value=db.empresa.email||'';$('em-dir').value=db.empresa.dir||'';$('em-eslogan').value=db.empresa.eslogan||'';$('em-margen').value=db.empresa.margen??30;if(db.empresa.logo)$('em-logo-preview').src=db.empresa.logo;$('empresa-ficha').innerHTML=`<h2>${db.empresa.nombre||'Empresa'}</h2><p>${db.empresa.eslogan||''}</p><p>RNC: ${db.empresa.rnc||'\u2014'}<br>${db.empresa.dir||''}<br>${db.empresa.tel||''} \u00b7 ${db.empresa.email||''}</p><p>Margen bruto estimado: <b>${db.empresa.margen||30}%</b></p>`}",
      ],
      agrega: [
        "function renderEmpresa(){$('em-nombre').value=db.empresa.nombre||'';$('em-rnc').value=db.empresa.rnc||'';$('em-tel').value=db.empresa.tel||'';$('em-email').value=db.empresa.email||'';$('em-dir').value=db.empresa.dir||'';$('em-eslogan').value=db.empresa.eslogan||'';$('em-margen').value=db.empresa.margen??30;if(db.empresa.logo)$('em-logo-preview').src=db.empresa.logo;$('empresa-ficha').innerHTML=`<h2>${esc(db.empresa.nombre||'Empresa')}</h2><p>${esc(db.empresa.eslogan||'')}</p><p>RNC: ${esc(db.empresa.rnc||'\u2014')}<br>${esc(db.empresa.dir||'')}<br>${esc(db.empresa.tel||'')} \u00b7 ${esc(db.empresa.email||'')}</p><p>Margen bruto estimado: <b>${esc(db.empresa.margen||30)}%</b></p>`}",
      ],
    },
    {
      archivo: "js/dominio/empresa.js",
      motivo: "Escapa los datos de empresa en la ficha y en la marca de la cabecera.",
      quita: [
        "function updateBrand(){$('brand').innerHTML=(db.empresa.nombre||'Moto Repuesto Sandy')+'<small>Gesti\u00f3n financiera y operacional</small>'}",
      ],
      agrega: [
        "function updateBrand(){$('brand').innerHTML=esc(db.empresa.nombre||'Moto Repuesto Sandy')+'<small>Gesti\u00f3n financiera y operacional</small>'}",
      ],
    },
    {
      archivo: "js/dominio/gastos.js",
      motivo: "Escapa categor\u00eda, beneficiario y descripci\u00f3n en la tabla de gastos y en el selector de obligaciones.",
      quita: [
        "function renderGastos(){fillAcreedores();const a=$('ga-desde').value,b=$('ga-hasta').value,f=$('ga-filtro').value,l=db.gastos.filter(x=>inRange(x.fecha,a,b)).filter(x=>!f||x.estado===f).sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-gastos').innerHTML=l.length?l.map(x=>`<tr><td>${x.codigo}</td><td>${fmtDate(x.fecha)}</td><td>${x.categoria}</td><td>${x.beneficiario||creditorName(x.acreedorId)||'\u2014'}</td><td>${x.descripcion||'\u2014'}</td><td class=\"r\">${money(x.monto)}</td><td><span class=\"pill ${x.estado==='Pendiente'?'yellow':x.estado==='Anulado'?'red':'green'}\">${x.estado}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('gasto','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('gasto','${x.id}')\">Imprimir</button><button class=\"btn danger\" onclick=\"anularGasto('${x.id}')\">Anular</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin gastos.</td></tr>';$('ga-sum').textContent=money(l.reduce((s,x)=>s+x.monto,0));$('ga-pend').textContent=money(l.filter(x=>x.estado==='Pendiente').reduce((s,x)=>s+x.monto,0));fillAcreedores();const obs=db.obligaciones.filter(o=>o.saldo>.004).map(o=>`<option value=\"${o.id}\">${creditorName(o.acreedorId)} \u2014 ${o.descripcion||o.tipo} \u2014 ${money(o.saldo)}</option>`).join('');if($('obp-obligacion'))$('obp-obligacion').innerHTML='<option value=\"\">Seleccione...</option>'+obs;renderHistorialGastos()}",
      ],
      agrega: [
        "function renderGastos(){fillAcreedores();const a=$('ga-desde').value,b=$('ga-hasta').value,f=$('ga-filtro').value,l=db.gastos.filter(x=>inRange(x.fecha,a,b)).filter(x=>!f||x.estado===f).sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-gastos').innerHTML=l.length?l.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${fmtDate(x.fecha)}</td><td>${esc(x.categoria)}</td><td>${esc(x.beneficiario||creditorName(x.acreedorId)||'\u2014')}</td><td>${esc(x.descripcion||'\u2014')}</td><td class=\"r\">${money(x.monto)}</td><td><span class=\"pill ${x.estado==='Pendiente'?'yellow':x.estado==='Anulado'?'red':'green'}\">${esc(x.estado)}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('gasto','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('gasto','${x.id}')\">Imprimir</button><button class=\"btn danger\" onclick=\"anularGasto('${x.id}')\">Anular</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin gastos.</td></tr>';$('ga-sum').textContent=money(l.reduce((s,x)=>s+x.monto,0));$('ga-pend').textContent=money(l.filter(x=>x.estado==='Pendiente').reduce((s,x)=>s+x.monto,0));fillAcreedores();const obs=db.obligaciones.filter(o=>o.saldo>.004).map(o=>`<option value=\"${esc(o.id)}\">${esc(creditorName(o.acreedorId))} \u2014 ${esc(o.descripcion||o.tipo)} \u2014 ${money(o.saldo)}</option>`).join('');if($('obp-obligacion'))$('obp-obligacion').innerHTML='<option value=\"\">Seleccione...</option>'+obs;renderHistorialGastos()}",
      ],
    },
    {
      archivo: "js/dominio/nomina.js",
      motivo: "Escapa nombre, cargo y c\u00f3digo de empleados, y nombre/metodo en la tabla de n\u00f3minas.",
      quita: [
        " const opts=db.empleados.filter(e=>e.activo!==false).map(e=>`<option value=\"${e.id}\">${e.codigo} \u2014 ${e.nombre}</option>`).join('');",
      ],
      agrega: [
        " const opts=db.empleados.filter(e=>e.activo!==false).map(e=>`<option value=\"${esc(e.id)}\">${esc(e.codigo)} \u2014 ${esc(e.nombre)}</option>`).join('');",
      ],
    },
    {
      archivo: "js/dominio/nomina.js",
      motivo: "Escapa nombre, cargo y c\u00f3digo de empleados, y nombre/metodo en la tabla de n\u00f3minas.",
      quita: [
        " $('tbl-empleados').innerHTML=emps.length?emps.map(e=>`<tr><td>${e.codigo}</td><td>${e.nombre}</td><td>${e.cargo||'\u2014'}</td><td>${e.frecuencia||'\u2014'}</td><td class=\"r\">${money(e.salarioMensual)}</td><td class=\"r\">${money(e.pagoPeriodo)}</td><td><span class=\"pill ${e.activo===false?'red':'green'}\">${e.activo===false?'Inactivo':'Activo'}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('empleado','${e.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('empleado','${e.id}')\">Imprimir</button><button class=\"btn secondary\" onclick=\"toggleEmpleado('${e.id}')\">${e.activo===false?'Activar':'Desactivar'}</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin empleados.</td></tr>';",
      ],
      agrega: [
        " $('tbl-empleados').innerHTML=emps.length?emps.map(e=>`<tr><td>${esc(e.codigo)}</td><td>${esc(e.nombre)}</td><td>${esc(e.cargo||'\u2014')}</td><td>${esc(e.frecuencia||'\u2014')}</td><td class=\"r\">${money(e.salarioMensual)}</td><td class=\"r\">${money(e.pagoPeriodo)}</td><td><span class=\"pill ${e.activo===false?'red':'green'}\">${e.activo===false?'Inactivo':'Activo'}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('empleado','${e.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('empleado','${e.id}')\">Imprimir</button><button class=\"btn secondary\" onclick=\"toggleEmpleado('${e.id}')\">${e.activo===false?'Activar':'Desactivar'}</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin empleados.</td></tr>';",
      ],
    },
    {
      archivo: "js/dominio/nomina.js",
      motivo: "Escapa nombre, cargo y c\u00f3digo de empleados, y nombre/metodo en la tabla de n\u00f3minas.",
      quita: [
        " $('tbl-nomina').innerHTML=l.length?l.map(n=>`<tr><td>${n.codigo}</td><td>${employeeName(n.empleadoId)}</td><td>${fmtDate(n.desde)} al ${fmtDate(n.hasta)}</td><td>${fmtDate(n.fecha)}</td><td class=\"r\">${money(n.monto)}</td><td><span class=\"pill ${n.estado==='Pagado'?'green':'yellow'}\">${n.estado}</span></td><td>${n.metodo||'\u2014'}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\">${n.estado==='Pendiente'?`<button class=\"btn\" onclick=\"pagarNomina('${n.id}')\">Pagar</button>`:''}<button class=\"btn secondary\" onclick=\"imprimirNomina('${n.id}')\">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin n\u00f3minas en el per\u00edodo seleccionado.</td></tr>';",
      ],
      agrega: [
        " $('tbl-nomina').innerHTML=l.length?l.map(n=>`<tr><td>${esc(n.codigo)}</td><td>${esc(employeeName(n.empleadoId))}</td><td>${fmtDate(n.desde)} al ${fmtDate(n.hasta)}</td><td>${fmtDate(n.fecha)}</td><td class=\"r\">${money(n.monto)}</td><td><span class=\"pill ${n.estado==='Pagado'?'green':'yellow'}\">${esc(n.estado)}</span></td><td>${esc(n.metodo||'\u2014')}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\">${n.estado==='Pendiente'?`<button class=\"btn\" onclick=\"pagarNomina('${n.id}')\">Pagar</button>`:''}<button class=\"btn secondary\" onclick=\"imprimirNomina('${n.id}')\">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan=\"8\" class=\"empty\">Sin n\u00f3minas en el per\u00edodo seleccionado.</td></tr>';",
      ],
    },
    {
      archivo: "js/dominio/obligaciones.js",
      motivo: "Escapa c\u00f3digo, tipo, acreedor y referencia del historial de pagos de gastos.",
      quita: [
        "function renderHistorialGastos(){const rows=[];db.pagosObligaciones.forEach(x=>{const o=db.obligaciones.find(z=>z.id===x.obligacionId);rows.push({type:'pagoObligacion',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:o?.tipo||'Gasto',acreedor:creditorName(o?.acreedorId),ref:x.referencia,monto:x.monto})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-pagos-gastos').innerHTML=rows.length?rows.map(x=>`<tr><td>${x.codigo}</td><td>${fmtDate(x.fecha)}</td><td>${x.tipo}</td><td>${x.acreedor}</td><td>${x.ref||'\u2014'}</td><td class=\"r\">${money(x.monto)}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('${x.type}','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('${x.type}','${x.id}')\">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan=\"7\" class=\"empty\">Sin pagos de gastos registrados.</td></tr>'}",
      ],
      agrega: [
        "function renderHistorialGastos(){const rows=[];db.pagosObligaciones.forEach(x=>{const o=db.obligaciones.find(z=>z.id===x.obligacionId);rows.push({type:'pagoObligacion',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:o?.tipo||'Gasto',acreedor:creditorName(o?.acreedorId),ref:x.referencia,monto:x.monto})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha));$('tbl-pagos-gastos').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.codigo)}</td><td>${fmtDate(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(x.acreedor)}</td><td>${esc(x.ref||'\u2014')}</td><td class=\"r\">${money(x.monto)}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('${x.type}','${x.id}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('${x.type}','${x.id}')\">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan=\"7\" class=\"empty\">Sin pagos de gastos registrados.</td></tr>'}",
      ],
    },
    {
      archivo: "js/dominio/pagos-prestamo.js",
      motivo: "Escapa c\u00f3digo, acreedor y referencia del historial de pagos de pr\u00e9stamos.",
      quita: [
        "function renderHistorialPagos(){const rows=[];db.pagosPrestamos.forEach(x=>{const p=db.prestamos.find(z=>z.id===x.prestamoId);rows.push({type:'pagoPrestamo',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:'Pr\u00e9stamo',acreedor:creditorName(p?.acreedorId),ref:x.referencia,monto:x.monto,estado:x.estado||'Activo'})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.codigo.localeCompare(a.codigo));$('tbl-pagos-oblig').innerHTML=rows.length?rows.map(x=>{const anulado=x.estado==='Anulado';return `<tr class=\"${anulado?'muted-row':''}\"><td>${x.codigo}</td><td>${fmtDate(x.fecha)}</td><td>${x.acreedor}</td><td>${x.ref||'\u2014'}</td><td class=\"r\">${money(x.monto)}</td><td><span class=\"pill ${anulado?'red':'green'}\">${anulado?'Anulado':'Activo'}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"printRecord('${x.type}','${x.id}')\">Imprimir</button>${anulado?'':`<button class=\"btn secondary\" onclick=\"openEditor('${x.type}','${x.id}')\">Editar</button><button class=\"btn danger\" onclick=\"anularPagoPrestamo('${x.id}')\">Anular</button>`}</div></td></tr>`}).join(''):'<tr><td colspan=\"7\" class=\"empty\">Sin pagos de pr\u00e9stamos registrados.</td></tr>'}",
      ],
      agrega: [
        "function renderHistorialPagos(){const rows=[];db.pagosPrestamos.forEach(x=>{const p=db.prestamos.find(z=>z.id===x.prestamoId);rows.push({type:'pagoPrestamo',id:x.id,codigo:x.codigo,fecha:x.fecha,tipo:'Pr\u00e9stamo',acreedor:creditorName(p?.acreedorId),ref:x.referencia,monto:x.monto,estado:x.estado||'Activo'})});rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.codigo.localeCompare(a.codigo));$('tbl-pagos-oblig').innerHTML=rows.length?rows.map(x=>{const anulado=x.estado==='Anulado';return `<tr class=\"${anulado?'muted-row':''}\"><td>${esc(x.codigo)}</td><td>${fmtDate(x.fecha)}</td><td>${esc(x.acreedor)}</td><td>${esc(x.ref||'\u2014')}</td><td class=\"r\">${money(x.monto)}</td><td><span class=\"pill ${anulado?'red':'green'}\">${anulado?'Anulado':'Activo'}</span></td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"printRecord('${x.type}','${x.id}')\">Imprimir</button>${anulado?'':`<button class=\"btn secondary\" onclick=\"openEditor('${x.type}','${x.id}')\">Editar</button><button class=\"btn danger\" onclick=\"anularPagoPrestamo('${x.id}')\">Anular</button>`}</div></td></tr>`}).join(''):'<tr><td colspan=\"7\" class=\"empty\">Sin pagos de pr\u00e9stamos registrados.</td></tr>'}",
      ],
    },
    {
      archivo: "js/dominio/pagos-suplidor.js",
      motivo: "Escapa el n\u00famero de factura en la tabla de aplicaci\u00f3n de pagos.",
      quita: [
        " $('pg-facturas').innerHTML=rows.length?`<table><thead><tr><th>Factura</th><th>Vence</th><th class=\"r\">Saldo</th><th class=\"r\">Aplicado</th><th>Tipo</th><th class=\"r\">Balance actual</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.x.documento||r.x.codigo}</td><td>${fmtDate(r.x.vencimiento)}</td><td class=\"r\">${money(r.x.saldo)}</td><td class=\"r\">${money(r.aplicado)}</td><td>${r.aplicado>.004?(r.nuevo<=.004?'Saldo':'Abono'):'\u2014'}</td><td class=\"r\">${money(r.nuevo)}</td></tr>`).join('')}</tbody></table>`:'';",
      ],
      agrega: [
        " $('pg-facturas').innerHTML=rows.length?`<table><thead><tr><th>Factura</th><th>Vence</th><th class=\"r\">Saldo</th><th class=\"r\">Aplicado</th><th>Tipo</th><th class=\"r\">Balance actual</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.x.documento||r.x.codigo)}</td><td>${fmtDate(r.x.vencimiento)}</td><td class=\"r\">${money(r.x.saldo)}</td><td class=\"r\">${money(r.aplicado)}</td><td>${r.aplicado>.004?(r.nuevo<=.004?'Saldo':'Abono'):'\u2014'}</td><td class=\"r\">${money(r.nuevo)}</td></tr>`).join('')}</tbody></table>`:'';",
      ],
    },
    {
      archivo: "js/dominio/prestamos.js",
      motivo: "Corrige el guardia de la amortizaci\u00f3n: con una cuota insuficiente se generaban las 12 filas completas y el aviso nunca se disparaba.",
      quita: [
        " if(rows.length<total && saldo>0.004)return notify('Las condiciones no permiten amortizar el pr\u00e9stamo con la cuota indicada');",
      ],
      agrega: [
        " // Con una cuota fija insuficiente el bucle completa las 12 filas y aun sobra saldo, as\u00ed",
        " // que la condici\u00f3n basada en rows.length nunca se cumpl\u00eda y se escrib\u00eda una tabla que no",
        " // amortiza. Basta con mirar el saldo que queda.",
        " if(saldo>0.004)return notify('Las condiciones no permiten amortizar el pr\u00e9stamo con la cuota indicada');",
      ],
    },
    {
      archivo: "js/dominio/ventas.js",
      motivo: "Escapa la nota semanal en la tabla de resultados.",
      quita: [
        "function renderGestion(kind){const prefix=kind==='contado'?'vc':kind==='credito'?'cr':'ri',a=$(prefix+'-desde').value,b=$(prefix+'-hasta').value,arr=kind==='contado'?db.gestionContado:kind==='credito'?db.gestionCredito:db.gestionRecibos,tb=$(kind==='contado'?'tbl-contado':kind==='credito'?'tbl-credito':'tbl-recibos'),list=[...arr].filter(x=>inRange(x.semanaFin,a,b)).sort((x,y)=>y.semanaFin.localeCompare(x.semanaFin));tb.innerHTML=list.length?list.map(x=>`<tr><td>${fmtDate(x.semanaFin)}</td><td class=\"r\">${money(x.monto)}</td><td>${x.nota||'\u2014'}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('gestion','${x.id}','${kind}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('gestion','${x.id}','${kind}')\">Imprimir</button><button class=\"btn danger\" onclick=\"delGestion('${kind}','${x.id}')\">Eliminar</button></div></td></tr>`).join(''):`<tr><td colspan=\"4\" class=\"empty\">Sin resultados semanales.</td></tr>`;$(kind==='contado'?'vc-sum':kind==='credito'?'cr-sum':'ri-sum').textContent=money(list.reduce((s,x)=>s+Number(x.monto||0),0))}",
      ],
      agrega: [
        "function renderGestion(kind){const prefix=kind==='contado'?'vc':kind==='credito'?'cr':'ri',a=$(prefix+'-desde').value,b=$(prefix+'-hasta').value,arr=kind==='contado'?db.gestionContado:kind==='credito'?db.gestionCredito:db.gestionRecibos,tb=$(kind==='contado'?'tbl-contado':kind==='credito'?'tbl-credito':'tbl-recibos'),list=[...arr].filter(x=>inRange(x.semanaFin,a,b)).sort((x,y)=>y.semanaFin.localeCompare(x.semanaFin));tb.innerHTML=list.length?list.map(x=>`<tr><td>${fmtDate(x.semanaFin)}</td><td class=\"r\">${money(x.monto)}</td><td>${esc(x.nota||'\u2014')}</td><td class=\"no-print action-cell\"><div class=\"action-buttons\"><button class=\"btn secondary\" onclick=\"openEditor('gestion','${x.id}','${kind}')\">Editar</button><button class=\"btn secondary\" onclick=\"printRecord('gestion','${x.id}','${kind}')\">Imprimir</button><button class=\"btn danger\" onclick=\"delGestion('${kind}','${x.id}')\">Eliminar</button></div></td></tr>`).join(''):`<tr><td colspan=\"4\" class=\"empty\">Sin resultados semanales.</td></tr>`;$(kind==='contado'?'vc-sum':kind==='credito'?'cr-sum':'ri-sum').textContent=money(list.reduce((s,x)=>s+Number(x.monto||0),0))}",
      ],
    },
    {
      archivo: "js/nucleo/almacen.js",
      motivo: "Envuelve localStorage.setItem en try/catch para que un fallo de cuota no aborte el guardado en silencio. Elimina el empleado de ejemplo con datos personales.",
      quita: [
        "function save(){localStorage.setItem(KEY,JSON.stringify(db));idbPutState().catch(()=>{});scheduleDriveBackup();}",
      ],
      agrega: [
        "function motivoFalloAlmacenamiento(e){return(e&&(e.name==='QuotaExceededError'||e.code===22))?'el almacenamiento de este navegador est\u00e1 lleno':(e&&e.message)||'error desconocido'}",
        "",
        "// localStorage.setItem lanza QuotaExceededError al superarse la cuota. Sin este",
        "// try/catch la excepci\u00f3n abortaba la l\u00ednea entera, as\u00ed que el espejo de IndexedDB y",
        "// el respaldo de Google Drive nunca se ejecutaban y el usuario no se enteraba de que",
        "// el registro se hab\u00eda perdido.",
        "function persistirLocal(){",
        "  try{localStorage.setItem(KEY,JSON.stringify(db));return true}",
        "  catch(e){",
        "    console.error('No se pudo guardar en localStorage:',e);",
        "    notify('No se pudo guardar: '+motivoFalloAlmacenamiento(e)+'. Exporta una copia de seguridad desde Mantenimiento.');",
        "    return false",
        "  }",
        "}",
        "",
        "function save(){persistirLocal();idbPutState().catch(()=>{});scheduleDriveBackup();}",
      ],
    },
    {
      archivo: "js/nucleo/almacen.js",
      motivo: "Envuelve localStorage.setItem en try/catch para que un fallo de cuota no aborte el guardado en silencio. Elimina el empleado de ejemplo con datos personales.",
      quita: [
        "function saveWithoutDrive(){localStorage.setItem(KEY,JSON.stringify(db));idbPutState().catch(()=>{})}",
      ],
      agrega: [
        "function saveWithoutDrive(){persistirLocal();idbPutState().catch(()=>{})}",
      ],
    },
    {
      archivo: "js/nucleo/almacen.js",
      motivo: "Envuelve localStorage.setItem en try/catch para que un fallo de cuota no aborte el guardado en silencio. Elimina el empleado de ejemplo con datos personales.",
      quita: [
        "// usando el saldo vigente como referencia y conservando el historial impl\u00edcito.",
      ],
      agrega: [
        "// usando el saldo vigente como referencia y conservamos el historial impl\u00edcito.",
      ],
    },
    {
      archivo: "js/nucleo/almacen.js",
      motivo: "Envuelve localStorage.setItem en try/catch para que un fallo de cuota no aborte el guardado en silencio. Elimina el empleado de ejemplo con datos personales.",
      quita: [
        "if(!db.empleados.some(e=>String(e.nombre||'').trim().toLowerCase()==='antonio de jes\u00fas')){",
        " const e={id:uid(),codigo:code('EMP',db.empleados),nombre:'Antonio de Jes\u00fas',cedula:'',cargo:'',fechaIngreso:today(),jornada:'Tiempo completo',frecuencia:'Quincenal',salarioMensual:10000,pagoPeriodo:5000,activo:true};",
        " db.empleados.push(e);save();",
        "}",
      ],
      agrega: [
      ],
    },
    {
      archivo: "js/nucleo/secuencias.js",
      motivo: "Hace que el reajuste de c\u00f3digos PPR se ejecute una sola vez, no en cada arranque.",
      quita: [
      ],
      agrega: [
        "  // Correcci\u00f3n \u00fanica, igual que GO. Antes se repet\u00eda en cada arranque: renumeraba",
        "  // todos los comprobantes de pr\u00e9stamo por fecha, as\u00ed que registrar un pago con fecha",
        "  // anterior reordenaba los recibos ya impresos y su n\u00famero dejaba de coincidir con el",
        "  // que muestra el sistema. El saldo no se toca, solo los c\u00f3digos.",
        "  if(db.seriales.PPR_reajustada===true)return false;",
      ],
    },
    {
      archivo: "js/nucleo/secuencias.js",
      motivo: "Hace que el reajuste de c\u00f3digos PPR se ejecute una sola vez, no en cada arranque.",
      quita: [
        "  let necesita=false;",
        "  pagos.forEach((x,i)=>{if(x.codigo!==`PPR-${String(i+1).padStart(5,'0')}`)necesita=true;});",
        "  if(!necesita){db.seriales.PPR=pagos.length;return false;}",
        "  pagos.forEach((x,i)=>{x.codigo=`PPR-${String(i+1).padStart(5,'0')}`;if(!x.estado)x.estado='Activo';});",
      ],
      agrega: [
        "  let cambio=false;",
        "  pagos.forEach((x,i)=>{const nuevo=`PPR-${String(i+1).padStart(5,'0')}`;if(x.codigo!==nuevo){x.codigo=nuevo;cambio=true}if(!x.estado)x.estado='Activo';});",
      ],
    },
    {
      archivo: "js/nucleo/secuencias.js",
      motivo: "Hace que el reajuste de c\u00f3digos PPR se ejecute una sola vez, no en cada arranque.",
      quita: [
        "  saveWithoutDrive();",
        "  return true;",
      ],
      agrega: [
        "  db.seriales.PPR_reajustada=true;",
        "  if(cambio)saveWithoutDrive();",
        "  return cambio;",
      ],
    },
    {
      archivo: "js/ui/impresion.js",
      motivo: "Sube row() a \u00e1mbito global (prestamos.js la usaba y no la encontraba) y escapa su valor.",
      quita: [
        "function printRecord(type,id,kind){let title='',body='';const row=(a,b)=>`<tr><td><b>${a}</b></td><td>${b}</td></tr>`;if(type==='gestion'){const arr=kind==='contado'?db.gestionContado:kind==='credito'?db.gestionCredito:db.gestionRecibos,x=arr.find(z=>z.id===id);title='Resultado semanal';body=`<h2>${kind==='contado'?'Ventas de contado':kind==='credito'?'Ventas a cr\u00e9dito':'Recibos de ingreso'}</h2><div class=\"box\"><table>${row('Semana terminada',fmtDate(x.semanaFin))}${row('Monto','RD$ '+money(x.monto))}${row('Observaci\u00f3n',x.nota||'\u2014')}</table></div>`}else if(type==='acreedor'){",
      ],
      agrega: [
        "// Fila etiqueta/valor compartida por todos los documentos imprimibles. Antes viv\u00eda",
        "// como const dentro de printRecord(), as\u00ed que prestamos.js no la encontraba al",
        "// imprimir la recepci\u00f3n de un pr\u00e9stamo.",
        "// `a` siempre es una etiqueta literal y `b` el dato, as\u00ed que escapar aqu\u00ed cubre los",
        "// 107 puntos de impresi\u00f3n de una sola vez. esc() no altera n\u00fameros ni fechas.",
        "function row(a,b){return `<tr><td><b>${a}</b></td><td>${esc(b)}</td></tr>`}",
        "",
        "function printRecord(type,id,kind){let title='',body='';if(type==='gestion'){const arr=kind==='contado'?db.gestionContado:kind==='credito'?db.gestionCredito:db.gestionRecibos,x=arr.find(z=>z.id===id);title='Resultado semanal';body=`<h2>${kind==='contado'?'Ventas de contado':kind==='credito'?'Ventas a cr\u00e9dito':'Recibos de ingreso'}</h2><div class=\"box\"><table>${row('Semana terminada',fmtDate(x.semanaFin))}${row('Monto','RD$ '+money(x.monto))}${row('Observaci\u00f3n',x.nota||'\u2014')}</table></div>`}else if(type==='acreedor'){",
      ],
    },
  ],
};
