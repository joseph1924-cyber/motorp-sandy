/* Acreedores — catálogo de acreedores/suplidores y facturas de mercancía
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function creditorById(id){return db.acreedores.find(x=>x.id===id)}

function creditorName(id){const a=creditorById(id);return a?a.nombre:'—'}

function addAcreedor(){const n=$('ac-nombre').value.trim(),cat=$('ac-categoria').value;if(!n)return notify('Nombre del acreedor obligatorio');if(db.acreedores.some(x=>x.nombre.toLowerCase()===n.toLowerCase()&&x.categoria===cat))return notify('Ese acreedor ya existe en esa categoría');const a={id:uid(),codigo:code('AC',db.acreedores),nombre:n,categoria:cat,rnc:$('ac-rnc').value,tel:$('ac-tel').value,dias:+$('ac-dias').value||0};db.acreedores.push(a);if(cat==='Suplidor')db.suplidores.push({id:uid(),codigo:code('SP',db.suplidores),acreedorId:a.id,nombre:n,rnc:a.rnc,tel:a.tel,dias:a.dias||30});save();['ac-nombre','ac-rnc','ac-tel'].forEach(i=>$(i).value='');renderCxp();renderGastos();notify('Acreedor guardado')}

function addSuplidor(){return addAcreedor()}

function fillAcreedores(){const all=db.acreedores.map(a=>`<option value="${a.id}">${a.nombre} — ${a.categoria}</option>`).join('');['pr-acreedor','ga-acreedor'].forEach(id=>{if($(id))$(id).innerHTML='<option value="">Seleccione...</option>'+all});const sups=db.suplidores.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join('');$('fx-sp').innerHTML='<option value="">Seleccione...</option>'+sups;const filtroSup=$('fx-tercero');if(filtroSup){const previo=filtroSup.value;filtroSup.innerHTML='<option value="">Todos los suplidores</option>'+db.suplidores.map(s=>`<option value="sup:${s.id}">${s.codigo?s.codigo+' — ':''}${esc(s.nombre)}</option>`).join('');if(previo&&db.suplidores.some(s=>('sup:'+s.id)===previo))filtroSup.value=previo;}$('pg-sp').innerHTML='<option value="">Seleccione...</option>'+sups;const sid=$('fx-tercero-id')?.value?.replace(/^sup:/,'');if(sid&&!db.suplidores.some(s=>s.id===sid)){if($('fx-tercero-id'))$('fx-tercero-id').value='';if($('fx-tercero'))$('fx-tercero').value='';}const ps=db.prestamos.map(p=>`<option value="${p.id}">${creditorName(p.acreedorId)} — ${money(p.saldo)} pendiente</option>`).join('');$('prp-prestamo').innerHTML='<option value="">Seleccione...</option>'+ps;const obs=db.obligaciones.filter(o=>o.saldo>.004&&obligacionVigente(o)).map(o=>`<option value="${o.id}">${creditorName(o.acreedorId)} — ${o.descripcion||o.tipo} — ${money(o.saldo)}</option>`).join('');$('obp-obligacion').innerHTML='<option value="">Seleccione...</option>'+obs}

function fillSuplidores(){fillAcreedores()}

function addFacturaSuplidor(){const sid=$('fx-sp').value,total=+$('fx-total').value,fecha=$('fx-fecha').value||today();if(!sid||total<=0)return notify('Suplidor y total son obligatorios');const dias=+$('fx-dias').value||0;const s=db.suplidores.find(x=>x.id===sid);db.facturasSuplidor.push({id:uid(),codigo:code('FCX',db.facturasSuplidor),suplidorId:sid,acreedorId:s?s.acreedorId:null,fecha,documento:$('fx-doc').value,concepto:$('fx-concepto').value,total,saldo:total,vencimiento:addDays(fecha,dias)});save();$('fx-total').value='';renderCxp();renderCronograma();renderDashboard();notify('Cuenta por pagar registrada')}

function estadoObligacion(o){if(Number(o.saldo||0)<=.004)return 'Pagada';if(o.vencimiento&&o.vencimiento<today())return 'Vencida';return 'Pendiente'}
