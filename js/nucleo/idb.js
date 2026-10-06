/* IndexedDB — espejo persistente y recuperación automática de pagos de préstamos
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

const DATA_IDB='moto_repuesto_sandy_data_test_v1';

function dataDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DATA_IDB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}

async function idbPutState(){const d=await dataDb();return new Promise((resolve,reject)=>{const t=d.transaction('state','readwrite');t.objectStore('state').put({savedAt:new Date().toISOString(),data:db},'current');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})}

async function idbGetState(){const d=await dataDb();return new Promise((resolve,reject)=>{const t=d.transaction('state','readonly'),q=t.objectStore('state').get('current');q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}

async function copyLocalToIndexedDB(show=true){try{await idbPutState();const r=await idbGetState();$('ms-idb-status').textContent='Operativa — copia paralela';$('ms-idb-last').textContent=fmtDateTime(r?.savedAt);if(show)notify('Datos actuales copiados a IndexedDB')}catch(e){$('ms-idb-status').textContent='No disponible';if(show)notify('IndexedDB no pudo guardar los datos: '+(e.message||e))}}

async function testIndexedDB(){try{await idbPutState();const r=await idbGetState();const ok=JSON.stringify(r?.data)===JSON.stringify(db);$('ms-idb-status').textContent=ok?'✓ Lectura y escritura correctas':'⚠ Verificación no coincide';$('ms-idb-last').textContent=fmtDateTime(r?.savedAt);notify(ok?'Prueba IndexedDB superada':'La prueba IndexedDB detectó una diferencia')}catch(e){$('ms-idb-status').textContent='No disponible';notify('Prueba IndexedDB falló: '+(e.message||e))}}

// Recuperación de pagos de préstamos desde la copia de IndexedDB.
//
// Antes esta función sustituía `db` en cuanto el espejo tenía MÁS pagos que el
// estado actual. Con la nube conectada eso es peligroso: el espejo local puede ser
// viejo, y aplicarlo machacaría el documento que se acaba de descargar del servidor,
// que es la fuente de verdad. Perder un pago guardado en otro dispositivo no es un
// precio aceptable por una reparación automática.
//
// Ahora solo AVISA y deja que sea la persona quien decida. Si además la nube está
// conectada, ni siquiera tiene sentido proponer nada: el servidor ya manda.
async function recoverLoanDataFromIndexedDB(){
  try{
    const snap=await idbGetState();
    const saved=snap?.data;
    if(!saved) return;
    const localPayments=Array.isArray(db.pagosPrestamos)?db.pagosPrestamos.length:0;
    const savedPayments=Array.isArray(saved.pagosPrestamos)?saved.pagosPrestamos.length:0;
    const sameLoans=Array.isArray(saved.prestamos)&&saved.prestamos.some(sp=>db.prestamos.some(lp=>lp.id===sp.id));
    if(!(savedPayments>localPayments && sameLoans)) return;
    if(nubeId){
      notify('La copia local de IndexedDB tiene más pagos de préstamos, pero la nube está conectada: manda el documento del servidor.');
      return;
    }
    const id='rec-idb-'+Date.now();
    const caja=$('ms-rec-idb');
    if(caja){
      caja.style.display='';
      $('ms-rec-idb-detalle').textContent=`La copia de IndexedDB tiene ${savedPayments} pagos de préstamos y el estado actual tiene ${localPayments}.`;
    }
    notify('Hay datos en IndexedDB que no están en el estado actual. Revísalo en Mantenimiento antes de aplicar nada.');
  }catch(e){}
}

/** Aplica a mano la copia de IndexedDB. Solo desde el botón, nunca al arrancar. */
async function aplicarRecuperacionIndexedDB(){
  try{
    const snap=await idbGetState();
    if(!snap?.data) return;
    if(!confirm('Se reemplazarán los datos actuales por la copia de IndexedDB. Si la nube está conectada, esto se subirá a los demás dispositivos. ¿Continuar?')) return;
    db=Object.assign(db,snap.data);
    normalizarDb();
    saveWithoutDrive();
    renderAllAfterDataChange();
    const caja=$('ms-rec-idb');
    if(caja)caja.style.display='none';
    notify('Datos de la copia de IndexedDB aplicados');
  }catch(e){notify('No se pudo aplicar la copia de IndexedDB: '+(e.message||e))}
}
