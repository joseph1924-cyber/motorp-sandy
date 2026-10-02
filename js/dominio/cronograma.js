/* Cronograma — compromisos de pago agrupados por semana
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function setNextWeek(){const d=isoDate(today()),day=d.getDay()||7,a=new Date(d);a.setDate(d.getDate()-day+8);const b=new Date(a);b.setDate(a.getDate()+6);$('co-desde').value=a.toISOString().slice(0,10);$('co-hasta').value=b.toISOString().slice(0,10)}

function semClass(d){const t=isoDate(today()),x=isoDate(d);const diff=Math.round((x-t)/86400000);return diff<=0?'red':diff<=3?'yellow':diff<=7?'green':'gray'}

function renderCronograma(){
 const a=$('co-desde').value||'',b=$('co-hasta').value||'',t=$('co-tipo').value||'';
 if(a&&b&&a>b){notify('La fecha desde no puede ser posterior a la fecha hasta');return}
 const items=[];
 const addItem=(fecha,tipo,benef,ref,monto,meta={})=>{
   if(!fecha||!inRange(fecha,a,b))return;
   const n=Number(monto||0);if(!(n>.004))return;
   items.push({fecha,tipo,benef:benef||'—',ref:ref||'—',monto:n,sem:semClass(fecha),...meta});
 };
 // 1) Mercancía a crédito: cada factura pendiente cuyo vencimiento cae dentro del período.
 if(!t||t==='suplidor'){
   db.facturasSuplidor.forEach(x=>{
     if(Number(x.saldo||0)<=.004)return;
     const s=db.suplidores.find(q=>q.id===x.suplidorId);
     addItem(x.vencimiento,'Suplidor',s?.nombre, x.documento||x.codigo, x.saldo,{source:'factura',id:x.id});
   });
 }
 // 2) Obligaciones de servicios, alquileres, impuestos y otros compromisos formales.
 if(!t||t==='obligacion'){
   db.obligaciones.forEach(x=>{
     if(Number(x.saldo||0)<=.004)return;
     addItem(x.vencimiento,x.tipo||'Obligación',creditorName(x.acreedorId),x.codigo,x.saldo,{source:'obligacion',id:x.id});
   });
 }
 // 3) Cuotas de préstamos pendientes: se usa el saldo restante de cada cuota, no el monto original.
 if(!t||t==='prestamo'){
   db.prestamos.forEach(p=>(p.cuotas||[]).forEach(q=>{
     const pendiente=Number(q.montoRestante??q.monto??0);
     if(q.estado==='Pagada'||pendiente<=.004)return;
     addItem(q.fecha,'Préstamo',creditorName(p.acreedorId),p.codigo+' · cuota #'+q.numero,pendiente,{source:'prestamo',id:p.id,cuota:q.numero});
   }));
 }
 // 4) Nómina pendiente. Se toma directamente de nóminas para que nunca desaparezca del cronograma.
 //    Su gasto vinculado no se vuelve a agregar abajo, evitando duplicados.
 if(!t||t==='gasto'){
   db.nominas.forEach(n=>{
     if(n.estado!=='Pendiente')return;
     addItem(n.fecha,'Nómina',employeeName(n.empleadoId),n.codigo,n.monto,{source:'nomina',id:n.id});
   });
   // 5) Gastos pendientes que no son obligaciones ni nóminas vinculadas.
   db.gastos.forEach(x=>{
     if(x.estado!=='Pendiente'||!x.vencimiento||x.obligacionId||x.nominaId)return;
     addItem(x.vencimiento,'Gasto',x.beneficiario||x.categoria,x.codigo,x.monto,{source:'gasto',id:x.id});
   });
 }
 items.sort((x,y)=>x.fecha.localeCompare(y.fecha)||x.benef.localeCompare(y.benef)||x.tipo.localeCompare(y.tipo)||x.ref.localeCompare(y.ref,undefined,{numeric:true}));
 const sums={red:0,yellow:0,green:0,gray:0};
 items.forEach(x=>sums[x.sem]=(sums[x.sem]||0)+x.monto);
 $('co-red').textContent=money(sums.red);$('co-yellow').textContent=money(sums.yellow);$('co-green').textContent=money(sums.green);
 $('co-total').textContent=money(items.reduce((s,x)=>s+x.monto,0));

 // El cronograma se presenta agrupado por suplidor/acreedor/beneficiario,
 // siguiendo el mismo lenguaje visual del Estado de cuenta: una tarjeta por tercero,
 // detalle de movimientos y una fila TOTALES al final de cada grupo.
 const groups={};
 items.forEach(x=>{
   const key=`${x.benef}||${x.tipo==='Suplidor'?'Suplidor':(x.tipo==='Préstamo'?'Acreedor':'Beneficiario')}`;
   (groups[key]??={benef:x.benef,items:[],tipo:'',total:0}).items.push(x);
   groups[key].total+=x.monto;
 });
 const ordered=Object.values(groups).sort((g1,g2)=>g1.benef.localeCompare(g2.benef,undefined,{sensitivity:'base'}));
 $('cronograma-body').innerHTML=items.length?`<div class="report-groups">${ordered.map(g=>{
   const kinds=[...new Set(g.items.map(x=>x.tipo))];
   const label=kinds.length===1?kinds[0]:'Compromisos';
   const rows=g.items.map(x=>{
     const dias=x.fecha<today()?Math.floor((isoDate(today())-isoDate(x.fecha))/86400000):0;
     const vencida=dias>0;
     const diasHtml=`<span class="days-status ${vencida?'red':'green'}">${dias} ${Math.abs(dias)===1?'día':'días'}</span>`;
     return `<tr class="${vencida?'danger-row':''}"><td>${fmtDate(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(x.ref)}</td><td>${diasHtml}</td><td class="r">${money(x.monto)}</td></tr>`;
   }).join('');
   return `<div class="card report-third-party cronograma-tercero"><h3 style="margin-top:0">${esc(g.benef)} <small>(${esc(label)})</small></h3><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Días vencidos</th><th class="r">Saldo</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="report-total-row"><td colspan="4">TOTALES</td><td class="r">${money(g.total)}</td></tr></tfoot></table></div>`;
 }).join('')}</div>`:'<div class="card empty">No hay compromisos pendientes con vencimiento en el rango seleccionado.</div>';
}

function previousSunday(){const d=isoDate(today()),day=d.getDay()||7;d.setDate(d.getDate()-day);return d.toISOString().slice(0,10)}
