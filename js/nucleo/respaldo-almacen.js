/* Respaldo automático — almacén de respaldos, retención y conexión
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

const DRIVE_IDB='moto_repuesto_sandy_drive_v1';

let driveBackupTimer=null;

function driveDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DRIVE_IDB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('settings'))r.result.createObjectStore('settings')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}

async function driveGet(key){try{const d=await driveDb();return await new Promise((resolve,reject)=>{const t=d.transaction('settings','readonly'),q=t.objectStore('settings').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}catch(e){return null}}

async function driveSet(key,value){const d=await driveDb();return new Promise((resolve,reject)=>{const t=d.transaction('settings','readwrite');t.objectStore('settings').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})}

async function driveDelete(key){const d=await driveDb();return new Promise((resolve,reject)=>{const t=d.transaction('settings','readwrite');t.objectStore('settings').delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})}

async function connectGoogleDriveFolder(){if(!('showDirectoryPicker' in window)){return notify('Esta versión de Chrome no permite seleccionar una carpeta desde este archivo. Actualiza Chrome o usa una carpeta sincronizada manualmente.')}try{const handle=await window.showDirectoryPicker({mode:'readwrite'});await driveSet('folderHandle',handle);await driveSet('folderName',handle.name);await driveSet('connectedAt',new Date().toISOString());securitySettings().driveFolder=handle.name;saveWithoutDrive();renderMantenimiento();notify('Carpeta de Google Drive conectada')}catch(e){if(e?.name!=='AbortError')notify('No se pudo conectar la carpeta: '+(e.message||e))}}

async function disconnectGoogleDriveFolder(){await driveDelete('folderHandle');await driveDelete('folderName');await driveDelete('connectedAt');securitySettings().driveFolder='';saveWithoutDrive();renderMantenimiento();notify('Carpeta de Drive desconectada')}

async function getDriveFolder(){return await driveGet('folderHandle')}

async function ensureDrivePermission(handle){try{let p=await handle.queryPermission({mode:'readwrite'});if(p!=='granted')p=await handle.requestPermission({mode:'readwrite'});return p==='granted'}catch(e){return false}}

async function cleanOldDriveBackups(folder,retention){try{const names=[];for await(const [name,h] of folder.entries()){if(name.startsWith('MotoRepuestoSandy_Backup_')&&name.endsWith('.json'))names.push({name,h})}names.sort((a,b)=>b.name.localeCompare(a.name));for(const x of names.slice(Math.max(0,Number(retention||30)))){try{await folder.removeEntry(x.name)}catch(e){}}}catch(e){}}

async function backupToDrive(reason='manual'){try{const folder=await getDriveFolder();if(!folder)return notify('Primero conecta una carpeta de Google Drive');if(!(await ensureDrivePermission(folder)))return notify('Chrome no concedió permiso para escribir en la carpeta de Drive');const p=await buildBackupPayload(),stamp=backupStamp(),latest='MotoRepuestoSandy_BACKUP_ULTIMO.json',dated=`MotoRepuestoSandy_Backup_${stamp}.json`;for(const name of [latest,dated]){const fh=await folder.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(JSON.stringify(p,null,2));await w.close()}securitySettings().lastDriveBackup=new Date().toISOString();saveWithoutDrive();await cleanOldDriveBackups(folder,securitySettings().retention);renderMantenimiento();notify('Copia de seguridad guardada en Google Drive')}catch(e){notify('No se pudo crear la copia en Drive: '+(e.message||e))}}

function scheduleDriveBackup(){const s=securitySettings();if(!s.autoDriveBackup)return;if(driveBackupTimer)clearTimeout(driveBackupTimer);driveBackupTimer=setTimeout(()=>backupToDrive('automatic'),3500)}

function setAutoDrive(){securitySettings().autoDriveBackup=$('ms-auto-drive').value==='si';saveWithoutDrive();notify(securitySettings().autoDriveBackup?'Copia automática activada':'Copia automática desactivada');renderMantenimiento()}

function setRetention(){securitySettings().retention=Number($('ms-retention').value)||30;saveWithoutDrive();notify('Retención actualizada');renderMantenimiento()}
