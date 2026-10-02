/* Personal — empleados y nómina
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function employeeById(id){return db.empleados.find(e=>e.id===id)}

function employeeName(id){return employeeById(id)?.nombre||'—'}

function fillEmpleados(){
 const opts=db.empleados.filter(e=>e.activo!==false).map(e=>`<option value="${e.id}">${e.codigo} — ${e.nombre}</option>`).join('');
 if($('nom-empleado'))$('nom-empleado').innerHTML='<option value="">Seleccione...</option>'+opts;
}

function suggestNominaMonto(){const e=employeeById($('nom-empleado')?.value);if(!e)return;if($('nom-monto'))$('nom-monto').value=Number(e.pagoPeriodo||0);}

function addEmpleado(){
 const n=$('emp-nombre').value.trim();if(!n)return notify('Nombre del empleado obligatorio');
 const salario=+$('emp-salario').value||0,periodo=+$('emp-periodo').value||0;
 if(salario<=0||periodo<=0)return notify('Indica el salario mensual y el pago por período');
 if(db.empleados.some(e=>String(e.nombre||'').trim().toLowerCase()===n.toLowerCase()&&e.activo!==false))return notify('Ese empleado ya existe');
 const e={id:uid(),codigo:code('EMP',db.empleados),nombre:n,cedula:$('emp-cedula').value.trim(),cargo:$('emp-cargo').value.trim(),fechaIngreso:$('emp-ingreso').value||today(),jornada:$('emp-jornada').value,frecuencia:$('emp-frecuencia').value,salarioMensual:salario,pagoPeriodo:periodo,activo:true};
 db.empleados.push(e);save();['emp-nombre','emp-cedula','emp-cargo','emp-salario','emp-periodo'].forEach(i=>$(i).value='');renderNomina();notify('Empleado registrado');
}

function delEmpleado(id){if(db.nominas.some(n=>n.empleadoId===id))return notify('No se puede eliminar: el empleado ya tiene nóminas. Puedes desactivarlo desde edición.');if(!confirm('¿Eliminar empleado?'))return;db.empleados=db.empleados.filter(e=>e.id!==id);save();renderNomina();notify('Empleado eliminado')}

function toggleEmpleado(id){const e=employeeById(id);if(!e)return;e.activo=e.activo===false;save();renderNomina();notify(e.activo?'Empleado activado':'Empleado desactivado')}

function addNomina(){
 const eid=$('nom-empleado').value,desde=$('nom-desde').value,hasta=$('nom-hasta').value,fecha=$('nom-fecha').value||today(),m=+$('nom-monto').value||0,estado=$('nom-estado').value,metodo=$('nom-metodo').value;
 if(!eid||!desde||!hasta||m<=0)return notify('Empleado, período y monto son obligatorios');if(hasta<desde)return notify('El período hasta no puede ser anterior al inicio');
 const e=employeeById(eid);if(!e)return notify('Empleado no encontrado');
 if(db.nominas.some(n=>n.empleadoId===eid&&n.desde===desde&&n.hasta===hasta))return notify('Ya existe una nómina para ese empleado y período');
 const n={id:uid(),codigo:code('NOM',db.nominas),empleadoId:eid,desde,hasta,fecha,monto:m,estado,metodo,referencia:$('nom-ref').value.trim(),nota:$('nom-nota').value.trim(),gastoId:null,creado:today()};
 const g={id:uid(),codigo:code('GO',db.gastos),fecha,categoria:'Nómina',beneficiario:e.nombre,descripcion:`Nómina ${fmtDate(desde)} al ${fmtDate(hasta)}`,monto:m,vencimiento:fecha,estado:estado==='Pagado'?'Pagado':'Pendiente',metodo:estado==='Pagado'?metodo:'No aplica aún',acreedorId:null,obligacionId:null,nominaId:n.id};
 n.gastoId=g.id;db.nominas.push(n);db.gastos.push(g);save();$('nom-monto').value='';$('nom-ref').value='';$('nom-nota').value='';renderNomina();renderGastos();renderDashboard();renderCronograma();notify(estado==='Pagado'?'Nómina registrada y pagada':'Nómina registrada como pendiente de pago');
}

function pagarNomina(id){const n=db.nominas.find(x=>x.id===id);if(!n||n.estado==='Pagado')return;if(!confirm(`¿Confirmas pagar la nómina ${n.codigo} por RD$ ${money(n.monto)}?`))return;const metodo=prompt('Método de pago (Efectivo, Transferencia, Cheque o Tarjeta):','Transferencia')||'Transferencia';const ref=prompt('Referencia (opcional):','')||'';n.estado='Pagado';n.fecha=today();n.metodo=metodo;n.referencia=ref;const g=db.gastos.find(x=>x.id===n.gastoId);if(g){g.estado='Pagado';g.metodo=metodo;g.vencimiento=n.fecha;}save();renderNomina();renderGastos();renderDashboard();renderCronograma();notify('Nómina pagada')}

function renderNomina(){
 fillEmpleados();
 const a=$('nom-f-desde')?.value||'',b=$('nom-f-hasta')?.value||'',f=$('nom-f-estado')?.value||'';
 const emps=[...db.empleados].sort((x,y)=>x.nombre.localeCompare(y.nombre,'es'));
 $('tbl-empleados').innerHTML=emps.length?emps.map(e=>`<tr><td>${e.codigo}</td><td>${e.nombre}</td><td>${e.cargo||'—'}</td><td>${e.frecuencia||'—'}</td><td class="r">${money(e.salarioMensual)}</td><td class="r">${money(e.pagoPeriodo)}</td><td><span class="pill ${e.activo===false?'red':'green'}">${e.activo===false?'Inactivo':'Activo'}</span></td><td class="no-print action-cell"><div class="action-buttons"><button class="btn secondary" onclick="openEditor('empleado','${e.id}')">Editar</button><button class="btn secondary" onclick="printRecord('empleado','${e.id}')">Imprimir</button><button class="btn secondary" onclick="toggleEmpleado('${e.id}')">${e.activo===false?'Activar':'Desactivar'}</button></div></td></tr>`).join(''):'<tr><td colspan="8" class="empty">Sin empleados.</td></tr>';
 const l=db.nominas.filter(n=>inRange(n.fecha,a,b)).filter(n=>!f||n.estado===f).sort((x,y)=>y.fecha.localeCompare(x.fecha));
 $('tbl-nomina').innerHTML=l.length?l.map(n=>`<tr><td>${n.codigo}</td><td>${employeeName(n.empleadoId)}</td><td>${fmtDate(n.desde)} al ${fmtDate(n.hasta)}</td><td>${fmtDate(n.fecha)}</td><td class="r">${money(n.monto)}</td><td><span class="pill ${n.estado==='Pagado'?'green':'yellow'}">${n.estado}</span></td><td>${n.metodo||'—'}</td><td class="no-print action-cell"><div class="action-buttons">${n.estado==='Pendiente'?`<button class="btn" onclick="pagarNomina('${n.id}')">Pagar</button>`:''}<button class="btn secondary" onclick="imprimirNomina('${n.id}')">Imprimir</button></div></td></tr>`).join(''):'<tr><td colspan="8" class="empty">Sin nóminas en el período seleccionado.</td></tr>';
 $('nom-sum').textContent=money(l.reduce((z,x)=>z+Number(x.monto||0),0));$('nom-pend').textContent=money(l.filter(x=>x.estado==='Pendiente').reduce((z,x)=>z+Number(x.monto||0),0));
}

function resetNominaFiltro(){if($('nom-f-desde'))$('nom-f-desde').value='';if($('nom-f-hasta'))$('nom-f-hasta').value='';if($('nom-f-estado'))$('nom-f-estado').value='';renderNomina()}
