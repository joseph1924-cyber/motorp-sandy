/* Cliente de Supabase por REST — Moto Repuesto Sandy.
 *
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 *
 * Por qué REST a mano y no el SDK de supabase-js: el SDK se carga desde un CDN o pesa
 * ~100 KB en el repositorio, y en ambos casos la app depende de algo externo para
 * arrancar. Aquí solo hacen falta cuatro peticiones (login, refresco, GET y PATCH), así
 * que escribirlas evita esa dependencia y mantiene el requisito de que la app funcione
 * aunque no haya red.
 *
 * Lo que sí hay que implementar a mano es el refresco del token, porque caduca a la
 * hora: `sbToken()` lo renueva solo, y `sbPeticion()` reintenta una vez si la petición
 * llega con un 401 por token caducado.
 */

const SB_SESION='moto_repuesto_sandy_sb_sesion_v1';
const SB_META='moto_repuesto_sandy_sb_meta_v1';

/* ── errores ────────────────────────────────────────────────────────────────
 * Se distinguen dos families porque la app reacciona distinto: un fallo de red
 * significa "sigue trabajando sin conexión", mientras que un 4xx significa que el
 * servidor rechazó la operación y reintentar solo no arregla nada. */

function sbError(mensaje,estado,codigo,red){
  const e=new Error(mensaje);
  e.sbEstado=estado??null;
  e.sbCodigo=codigo??null;
  e.sbRed=!!red;
  return e;
}

const sbEsFalloRed=(e)=>!!(e&&e.sbRed);

/* ── sesión ────────────────────────────────────────────────────────────────
 * Se guarda en localStorage y no en memoria para que cerrar y reabrir la app no
 * obligue a volver a escribir la contraseña: el refresh token dura semanas. */

function sbLeerSesion(){
  try{const s=JSON.parse(localStorage.getItem(SB_SESION)||'null');return(s&&s.refresh_token&&s.user)?s:null}
  catch(e){return null}
}

function sbGuardarSesion(s){try{localStorage.setItem(SB_SESION,JSON.stringify(s))}catch(e){console.error('Supabase: no se pudo guardar la sesión',e)}}

function sbOlvidarSesion(){try{localStorage.removeItem(SB_SESION)}catch(e){}}

/* El `exp` va en el payload del JWT, sin cifrar: solo se usa para saber cuándo
 * renovar, nunca para autorizar nada. El servidor es quien valida la firma. */
function sbExpiracion(token){
  try{
    const p=JSON.parse(atob(String(token).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return Number(p.exp||0)*1000;
  }catch(e){return 0}
}

function sbTokenVigente(){
  const s=sbLeerSesion();
  if(!s)return null;
  if(sbExpiracion(s.access_token)-Date.now()>60e3)return s.access_token;
  return null;
}

/* ── peticiones ────────────────────────────────────────────────────────────
 * Una función para todo: así el manejo del token y el refresco no puede quedar
 * sentido en uno de los sitios y olvidado en otro. */

async function sbPeticion(metodo,ruta,{token,cuerpo,prefiere,reintentar=true}={}){
  const cab={
    apikey:SUPABASE_ANON_KEY,
    'Content-Type':'application/json',
    Authorization:'Bearer '+(token||SUPABASE_ANON_KEY),
  };
  if(prefiere)cab.Prefer=prefiere;

  let r;
  try{
    r=await fetch(SUPABASE_URL+ruta,{
      method:metodo,headers:cab,
      body:cuerpo===undefined?undefined:JSON.stringify(cuerpo),
    });
  }catch(e){
    // fetch solo lanza cuando no hubo respuesta: no hay red, DNS, CORS o el
    // navegador bloqueó la petición. No es un error del servidor.
    throw sbError('sin conexión con Supabase: '+(e.message||e),null,null,true);
  }

  const texto=await r.text();
  let datos=null;
  try{datos=texto?JSON.parse(texto):null}catch(e){datos=texto}

  if(r.ok)return{estado:r.status,datos};

  const codigo=datos&&typeof datos==='object'?datos.code:null;

  /* 401 con refresh token: se renueva y se repite una sola vez, para no entrar en
   * bucle si el refresh también falla. */
  if(r.status===401&&reintentar&&sbLeerSesion()){
    const s=sbLeerSesion();
    const nuevo=await sbRenovar(s.refresh_token);
    if(nuevo){sbGuardarSesion(nuevo);return sbPeticion(metodo,ruta,{token:nuevo.access_token,cuerpo,prefiere,reintentar:false})}
  }

  throw sbError(`Supabase respondió ${r.status}${codigo?' ('+codigo+')':''}: ${datos?.message||datos||''}`,r.status,codigo,false);
}

/* ── autenticación ───────────────────────────────────────────────────────── */

async function sbRenovar(refresh_token){
  if(!refresh_token)return null;
  try{
    const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token}),
    });
    if(!r.ok)return null;
    const d=await r.json();
    if(!d.access_token)return null;
    return{access_token:d.access_token,refresh_token:d.refresh_token||refresh_token,user:d.user||null};
  }catch(e){return null}
}

/** Devuelve un token válido, renovándolo si hace falta. Null si no hay sesión. */
async function sbToken(){
  const directo=sbTokenVigente();
  if(directo)return directo;
  const s=sbLeerSesion();
  if(!s)return null;
  const nuevo=await sbRenovar(s.refresh_token);
  if(!nuevo){sbOlvidarSesion();return null}
  sbGuardarSesion(nuevo);
  return nuevo.access_token;
}

async function sbIniciarSesion(correo,clave){
  const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:correo,password:clave}),
  });
  const d=await r.json().catch(()=>null);
  if(!r.ok){
    const msg=/invalid login credentials/i.test(d?.error_description||d?.msg||'')
      ?'Correo o contraseña incorrectos'
      :(d?.msg||d?.error_description||('Supabase respondió '+r.status));
    throw sbError(msg,r.status,d?.code??null,false);
  }
  const s={access_token:d.access_token,refresh_token:d.refresh_token,user:d.user||null};
  sbGuardarSesion(s);
  return s;
}

function sbCerrarSesion(){sbOlvidarSesion()}

/* ── el documento ──────────────────────────────────────────────────────────
 * Un único documento JSONB por usuario. El `rev` lo incrementa solo la app, y cada
 * escritura se condiciona a `rev=eq.<rev que el cliente cree tener>`: si otro
 * dispositivo escribió mientras este estaba sin conexión, el PATCH no toca nada y
 * devuelve 0 filas. Eso convierte una pérdida de datos silenciosa en un aviso. */

const SB_REST='/rest/v1/'+SUPABASE_TABLA;

async function sbLeerDocumento(){
  const token=await sbToken();
  if(!token)throw sbError('sin sesión',401,'no_session',false);
  const {datos}=await sbPeticion('GET',SB_REST+'?select=id,rev,data&limit=1',{token});
  if(!Array.isArray(datos)||!datos.length)return null;
  const f=datos[0];
  return{id:f.id,rev:Number(f.rev)||1,data:f.data};
}

/** Crea el documento. Solo válido si no existe ninguno para este usuario. */
async function sbCrearDocumento(data){
  const token=await sbToken();
  if(!token)throw sbError('sin sesión',401,'no_session',false);
  const {datos}=await sbPeticion('POST',SB_REST+'?select=id,rev',{
    token,prefiere:'return=representation',cuerpo:{data,rev:1},
  });
  const f=Array.isArray(datos)?datos[0]:null;
  if(!f)throw sbError('el servidor no devolvió el documento creado',200,null,false);
  return{id:f.id,rev:Number(f.rev)||1};
}

/** Guarda el estado. Devuelve {id,rev} al avanzar, o {conflicto:true} si otro
 *  dispositivo escribió antes: en ese caso el servidor NO ha modificado nada. */
async function sbGuardarDocumento(data,rev,id){
  const token=await sbToken();
  if(!token)throw sbError('sin sesión',401,'no_session',false);
  const siguiente=rev+1;
  const ruta=SB_REST+'?id=eq.'+encodeURIComponent(id)+'&rev=eq.'+rev;
  const {datos}=await sbPeticion('PATCH',ruta,{
    token,prefiere:'return=representation',cuerpo:{data,rev:siguiente},
  });
  if(Array.isArray(datos)&&datos.length)return{id,rev:Number(datos[0].rev)||siguiente};
  return{conflicto:true,rev};
}

async function sbBorrarDocumento(id){
  const token=await sbToken();
  if(!token)throw sbError('sin sesión',401,'no_session',false);
  await sbPeticion('DELETE',SB_REST+'?id=eq.'+encodeURIComponent(id),{
    token,prefiere:'return=representation',
  });
}

/* ── metadatos locales de sincronización ─────────────────────────────────────
 * Guardar el `rev` conocido junto a la marca de "pendiente" es lo que permite
 * recuperar una escritura que no llegó a subirse: si al abrir la app el rev local es
 * mayor que el de la nube, se sabe que quedó algo sin enviar. */

function sbLeerMeta(){
  try{return JSON.parse(localStorage.getItem(SB_META)||'null')}catch(e){return null}
}

function sbGuardarMeta(m){
  try{localStorage.setItem(SB_META,JSON.stringify(m))}catch(e){}
}

function sbOlvidarMeta(){try{localStorage.removeItem(SB_META)}catch(e){}}