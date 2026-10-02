/* Resultados — tablero de rentabilidad y saldos por tipo de tercero
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function estadoFactura(f,cutoff=today()){if(Number(f.saldo||0)<=.004)return 'Pagada'; if((f.vencimiento||'')<cutoff)return 'Vencida';return 'Pendiente'}

function balanceAsOfSupplier(f,cutoff){if(!cutoff)return Number(f.saldo||0);let b=Number(f.saldo||0);db.pagosSuplidor.forEach(p=>{if((p.fecha||'')>cutoff)(p.aplicaciones||[]).forEach(a=>{if(a.facturaId===f.id)b+=Number(a.aplicado||0)})});return Math.max(0,Math.round(b*100)/100)}

function balanceAsOfObligation(o,cutoff){if(!cutoff)return Number(o.saldo||0);let b=Number(o.saldo||0);db.pagosObligaciones.forEach(p=>{if(p.obligacionId===o.id&&(p.fecha||'')>cutoff)b+=Number(p.monto||0)});return Math.max(0,Math.round(b*100)/100)}

function balanceAsOfLoan(p,cutoff){if(!cutoff)return Number(p.saldo||0);let b=Number(p.saldo||0);db.pagosPrestamos.forEach(pg=>{if(pg.prestamoId===p.id&&pagoPrestamoActivo(pg)&&(pg.fecha||'')>cutoff)b+=Number(pg.monto||0)});return Math.max(0,Math.round(b*100)/100)}

function toggleCxpFechas(){const corte=$('fx-modo')?.value==='corte';if($('fx-rango-desde'))$('fx-rango-desde').style.display=corte?'none':'';if($('fx-rango-hasta'))$('fx-rango-hasta').style.display=corte?'none':'';if($('fx-corte-wrap'))$('fx-corte-wrap').style.display=corte?'':'none'}

function nextRange(kind){const d=isoDate(today());let a=new Date(d),b=new Date(d);if(kind==='semana'){const day=d.getDay()||7;a.setDate(d.getDate()-day+1);b=new Date(a);b.setDate(a.getDate()+6)}else if(kind==='mes'){a.setDate(1);b=new Date(a.getFullYear(),a.getMonth()+1,0)}else if(kind==='trimestre'){const q=Math.floor(d.getMonth()/3);a=new Date(d.getFullYear(),q*3,1);b=new Date(d.getFullYear(),q*3+3,0)}return [a.toISOString().slice(0,10),b.toISOString().slice(0,10)]}

function setDashPeriod(){const p=$('dash-period').value;if(p!=='personalizado'){const [a,b]=nextRange(p);$('dash-desde').value=a;$('dash-hasta').value=b}}

function saldoObligaciones(){return db.obligaciones.reduce((z,x)=>z+Number(x.saldo||0),0)}

function saldoPrestamos(){return db.prestamos.reduce((z,x)=>z+Number(x.saldo||0),0)}

function saldoSuplidores(){return db.facturasSuplidor.reduce((z,x)=>z+Number(x.saldo||0),0)}

function renderDashboard(){const a=$('dash-desde').value,b=$('dash-hasta').value,s=scoreGestion(a,b),m=Math.max(0,Number(db.empresa.margen||30))/100,br=s.total*m,costo=s.total-br,g=db.gastos.filter(x=>inRange(x.fecha,a,b)).reduce((z,x)=>z+x.monto,0),op=br-g,cxp=saldoSuplidores()+saldoObligaciones()+saldoPrestamos(),pg=db.gastos.filter(x=>x.estado==='Pendiente').reduce((z,x)=>z+x.monto,0);['d-contado','r-contado'].forEach(i=>$(i).textContent=money(s.c));['d-credito','r-credito'].forEach(i=>$(i).textContent=money(s.cr));['d-ventas','r-ventas'].forEach(i=>$(i).textContent=money(s.total));['d-bruta','r-bruta'].forEach(i=>$(i).textContent=money(br));$('r-costo').textContent=money(costo);['d-gastos','r-gastos'].forEach(i=>$(i).textContent=money(g));['d-operacional','r-op'].forEach(i=>$(i).textContent=money(op));$('r-margen').textContent=(m*100).toFixed(1)+'%';$('d-cobros').textContent=money(s.ri);$('d-cxc').textContent='—';$('d-cxp').textContent=money(cxp);$('d-pendg').textContent=money(pg);$('mix-c').textContent=money(s.c);$('mix-cr').textContent=money(s.cr);$('mix-c-p').textContent=s.total?((s.c/s.total)*100).toFixed(1)+'%':'0%';$('mix-cr-p').textContent=s.total?((s.cr/s.total)*100).toFixed(1)+'%':'0%';if($('d-score'))$('d-score').textContent=money(s.ri);if($('d-score-p'))$('d-score-p').textContent=s.total?s.score.toFixed(1)+'%':'0%'}
