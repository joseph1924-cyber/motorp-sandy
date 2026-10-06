/* Almacén — esquema de datos, persistencia, carga y migraciones
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

const KEY='moto_repuesto_sandy_finanzas_v1';

let db={empresa:{nombre:'Moto Repuesto Sandy',margen:30},gestionContado:[],gestionCredito:[],gestionRecibos:[],suplidores:[],facturasSuplidor:[],pagosSuplidor:[],gastos:[],empleados:[],nominas:[],acreedores:[],obligaciones:[],prestamos:[],pagosObligaciones:[],pagosPrestamos:[],seriales:{}};

function motivoFalloAlmacenamiento(e){return(e&&(e.name==='QuotaExceededError'||e.code===22))?'el almacenamiento de este navegador está lleno':(e&&e.message)||'error desconocido'}

// localStorage.setItem lanza QuotaExceededError al superarse la cuota. Sin este
// try/catch la excepción abortaba la línea entera, así que el espejo de IndexedDB y
// el respaldo de Google Drive nunca se ejecutaban y el usuario no se enteraba de que
// el registro se había perdido.
function persistirLocal(){
  try{localStorage.setItem(KEY,JSON.stringify(db));return true}
  catch(e){
    console.error('No se pudo guardar en localStorage:',e);
    notify('No se pudo guardar: '+motivoFalloAlmacenamiento(e)+'. Exporta una copia de seguridad desde Mantenimiento.');
    return false
  }
}

function save(){persistirLocal();idbPutState().catch(()=>{});scheduleDriveBackup();nubeMarcarSucio();}

/* ==================== MANTENIMIENTO Y SEGURIDAD ==================== */

function saveWithoutDrive(){persistirLocal();idbPutState().catch(()=>{});nubeMarcarSucio()}

function databaseStats(){const textData=JSON.stringify(db),bytes=new Blob([textData]).size;return {bytes,contado:db.gestionContado.length,credito:db.gestionCredito.length,recibos:db.gestionRecibos.length,acreedores:db.acreedores.length,facturas:db.facturasSuplidor.length,prestamos:db.prestamos.length,pagos:db.pagosSuplidor.length+db.pagosObligaciones.length+db.pagosPrestamos.length,gastos:db.gastos.length+db.obligaciones.length}}

function renderAllAfterDataChange(){renderDashboard();renderGestion('contado');renderGestion('credito');renderGestion('recibos');renderCxp();renderGastos();renderCronograma();renderEmpresa();renderMantenimiento()}

function reconciliarPagosPrestamoCalendario(){
  // Reconoce pagos que ya quedaron aplicados en el calendario de cuotas pero
  // que por una versión anterior del sistema no quedaron registrados en
  // db.pagosPrestamos. Esto evita que el estado de cuenta pierda el pago.
  let changed=false;
  db.prestamos.forEach(p=>{
    if(!Array.isArray(p.cuotas)||!p.cuotas.length)return;
    const registrado=db.pagosPrestamos.filter(x=>x.prestamoId===p.id&&pagoPrestamoActivo(x)).reduce((s,x)=>s+Number(x.monto||0),0);
    const aplicadoCalendario=p.cuotas.reduce((s,q)=>{
      const total=Number(q.monto||0);
      const restante=Number(q.montoRestante??(q.estado==='Pagada'?0:total));
      return s+Math.max(0,total-restante);
    },0);
    const faltante=Math.round((aplicadoCalendario-registrado)*100)/100;
    if(faltante<=.004)return;

    const apps=[];let restante=faltante;
    for(const q of p.cuotas){
      if(restante<=.004)break;
      const total=Number(q.monto||0);
      const saldoQ=Number(q.montoRestante??(q.estado==='Pagada'?0:total));
      const aplicado=Math.min(restante,Math.max(0,total-saldoQ));
      if(aplicado>.004){apps.push({numero:q.numero,aplicado});restante-=aplicado;}
    }
    if(!apps.length)return;
    const fecha=today();
    db.pagosPrestamos.push({
      id:uid(),codigo:code('PPR',db.pagosPrestamos),prestamoId:p.id,
      fecha,monto:faltante,metodo:'Efectivo',
      referencia:loanPaymentPreview(p,faltante)||`Saldo cuota ${apps[0].numero} de ${p.totalCuotas}`,
      aplicaciones:apps,importadoCalendario:true
    });
    p.saldo=Math.round((Number(p.saldo||0)-faltante)*100)/100;
    if(p.saldo<0&&p.saldo>-.004)p.saldo=0;
    const next=p.cuotas.find(q=>q.estado!=='Pagada');
    p.proximaCuota=next?next.numero:p.totalCuotas;
    p.proximoVencimiento=next?next.fecha:'';
    p.cuotasPagadas=p.cuotas.filter(q=>q.estado==='Pagada').length;
    changed=true;
  });
  if(changed)saveWithoutDrive();
  return changed;
}

/* Lectura de localStorage + normalización. La normalización va aparte porque al
 * arrancar puede haber dos fuentes: localStorage y el documento de Supabase. Ambas
 * dejan `db` en un estado válido solo pasando por aquí, y duplicar esas reglas de
 * saneado en el camino de la nube sería garantir que algún día se desincronizan. */
function load(){try{const x=localStorage.getItem(KEY);if(x)db=Object.assign(db,JSON.parse(x));}catch(e){};normalizarDb();}

function normalizarDb(){db.seriales=Object.assign({},db.seriales||{});db.empresa=Object.assign({nombre:'Moto Repuesto Sandy',margen:30},db.empresa||{});
  db.prestamos.forEach(p=>{if(!Array.isArray(p.cuotas))p.cuotas=[];p.cuotas.forEach(q=>{if(!q.codigo)q.codigo=code('CQP',db.prestamos.flatMap(z=>z.cuotas||[]));});if(p.modalidad==null)p.modalidad='Cuota fija — capital e interés';if(p.tasaMensual==null)p.tasaMensual=0;if(p.tasaAnual==null)p.tasaAnual=0;if(p.seguroPorCuota==null)p.seguroPorCuota=0;if(!Array.isArray(p.historialPrevio))p.historialPrevio=[];if(p.tieneAmortizacion==null)p.tieneAmortizacion=false;if(p.situacionInicial==null)p.situacionInicial=p.pagosIniciales>0?'existente':'nuevo';});
['gestionContado','gestionCredito','gestionRecibos','suplidores','facturasSuplidor','pagosSuplidor','gastos','empleados','nominas','acreedores','obligaciones','prestamos','pagosObligaciones','pagosPrestamos'].forEach(k=>{if(!Array.isArray(db[k]))db[k]=[]});
// Migración: los suplidores existentes pasan a formar parte del catálogo general de acreedores.
db.suplidores.forEach(s=>{if(!s.acreedorId){let a=db.acreedores.find(x=>x.nombre===s.nombre&&x.categoria==='Suplidor');if(!a){a={id:uid(),codigo:code('AC',db.acreedores),nombre:s.nombre,categoria:'Suplidor',rnc:s.rnc||'',tel:s.tel||'',dias:s.dias||30};db.acreedores.push(a)}s.acreedorId=a.id;}});
db.facturasSuplidor.forEach(f=>{const s=db.suplidores.find(x=>x.id===f.suplidorId);if(s)f.acreedorId=s.acreedorId;});
// Mantener coherente el calendario: una cuota pagada conserva su monto original.
db.prestamos.forEach(p=>{(p.cuotas||[]).forEach(q=>{if(q.estado==='Pagada'&&q.montoRestante==null)q.montoRestante=0;});});
reconciliarPagosPrestamoCalendario();
// Los comprobantes de pago son la fuente operativa para disminuir el saldo.
// Si una versión anterior guardó pagos pero dejó el saldo desfasado, lo corregimos
// usando el saldo vigente como referencia y conservamos el historial implícito.
db.pagosPrestamos.forEach(pg=>{const p=db.prestamos.find(x=>x.id===pg.prestamoId);if(!p)return;});
}
