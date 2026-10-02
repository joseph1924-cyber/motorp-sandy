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

// Recuperación automática: si esta copia local perdió pagos de préstamos pero la copia
// paralela de IndexedDB conserva una versión más completa, recuperamos esos datos.
async function recoverLoanDataFromIndexedDB(){
  try{
    const snap=await idbGetState();
    const saved=snap?.data;
    if(!saved) return;
    const localPayments=Array.isArray(db.pagosPrestamos)?db.pagosPrestamos.length:0;
    const savedPayments=Array.isArray(saved.pagosPrestamos)?saved.pagosPrestamos.length:0;
    const sameLoans=Array.isArray(saved.prestamos)&&saved.prestamos.some(sp=>db.prestamos.some(lp=>lp.id===sp.id));
    if(savedPayments>localPayments && sameLoans){
      db=Object.assign(db,saved);
      saveWithoutDrive();
      renderAllAfterDataChange();
      notify('Datos de préstamos recuperados correctamente');
    }
  }catch(e){}
}
