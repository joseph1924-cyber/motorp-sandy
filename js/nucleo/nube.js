/* Motor de sincronización con Supabase — Moto Repuesto Sandy.
 *
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 *
 * Idea central: Supabase es la fuente de verdad, pero la app nunca espera a la red para
 * funcionar. `save()` sigue escribiendo en localStorage de forma síncrona, así que la
 * interfaz es igual de instantánea que antes; en paralelo se marca el documento como
 * pendiente y se sube con un retardo de 1,5 s, agrupando así los teclees seguidos.
 *
 * Sobrevivir a que se cierre la pestaña: la marca de pendiente se guarda en
 * localStorage en el mismo instante que se registra el cambio, no cuando se sube. Si
 * el navegador se cierra antes de que la red responda, al volver a abrir la app se
 * detecta que el rev local no cuadra con el de la nube y se reenvía. No hace falta
 * pedirle nada al navegador en el momento de cerrar, que es cuando no sirve de nada.
 *
 * Conflictos: cada subida se condiciona a `rev=eq.<rev conocido>`. Si otro dispositivo
 * escribió mientras este estaba sin conexión, el PATCH no modifica nada y devuelve 0
 * filas. En ese caso la sincronización se detiene y se avisa, en lugar de decidir por
 * la cabeza cuál de las dos versiones se queda con los datos.
 */

const NUBE_ESPERA='espera';
const NUBE_SIN='sin-conexion';
const NUBE_LIMPIO='sincronizado';
const NUBE_PENDIENTE='pendiente';
const NUBE_SUBIENDO='subiendo';
const NUBE_CONFLICTO='conflicto';
const NUBE_ERROR='error';

const NUBE_RETRASO=1500;

let nubeEstado=NUBE_ESPERA;
let nubeDetalle='';
let nubeId=null;
let nubeRev=0;
let nubeSucio=false;
let nubeConflicto=null;
let nubeTemporizador=null;
let nubeSubiendo=false;

/* Durante la hidratación desde la nube se desactiva el marcado de pendiente: cargar un
 * documento remoto no es un cambio del usuario y no debe provocar una subida. */
let nubeCallada=false;

/* ── estado y avisos ─────────────────────────────────────────────────────── */

const NUBE_TEXTOS={
  [NUBE_ESPERA]:['Sin conectar','Aún no se ha intentado conectar con la nube.'],
  [NUBE_SIN]:['Sin conexión','Los cambios se guardan en este dispositivo y se subirán al recuperar la red.'],
  [NUBE_LIMPIO]:['Sincronizado','Este dispositivo está al día con la nube.'],
  [NUBE_PENDIENTE]:['Guardando','Cambios pendientes de subir a la nube.'],
  [NUBE_SUBIENDO]:['Subiendo','Enviando los cambios a la nube.'],
  [NUBE_CONFLICTO]:['Conflicto sin resolver','Otro dispositivo guardó cambios mientras este estaba sin conexión.'],
  [NUBE_ERROR]:['Error de nube','No se pudo sincronizar.'],
};

function nubeEstablecer(estado,detalle){
  nubeEstado=estado;
  if(detalle!==undefined)nubeDetalle=detalle;
  nubePintar();
}

function nubeHayRed(){
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return false;
  return true;
}

/* Copia del estado en el instante de subir. Sin esto, si el usuario sigue escribiendo
 * mientras la petición está en vuelo, se enviaría un documento inconsistente. */
function nubeInstantanea(){return JSON.parse(JSON.stringify(db))}

function nubePintar(){
  const [titulo,detalle]=NUBE_TEXTOS[nubeEstado]||['—',''];
  const e=$('nube-estado');
  if(e)e.textContent=titulo;
  const d=$('nube-detalle');
  if(d)d.textContent=nubeDetalle||detalle;

  const aviso=$('nube-aviso');
  if(aviso)aviso.style.display=nubeEstado===NUBE_CONFLICTO?'':'none';
  const at=$('nube-aviso-texto');
  if(at)at.textContent=nubeEstado===NUBE_CONFLICTO
    ?'Hay dos versiones del documento y ninguna se puede descartar sola. Elige cuál conservar.'
    :'';

  /* Mantenimiento refleja el estado real en vez de decir siempre «Operativa». */
  const ms=$('ms-db-status');
  if(ms)ms.textContent=nubeEstadoTexto();
  const md=$('ms-db-detail');
  if(md)md.textContent=nubeDetalleTexto();
  const ns=$('ms-nube-status');
  if(ns)ns.textContent=nubeEstadoTexto();
  const nd=$('ms-nube-detail');
  if(nd)nd.textContent=nubeDetalleTexto();
  const nr=$('ms-nube-rev');
  if(nr)nr.textContent=nubeRev?'r'+nubeRev:'—';
}

function nubeEstadoTexto(){
  if(nubeEstado===NUBE_ESPERA)return'Sin conectar';
  if(nubeEstado===NUBE_LIMPIO)return'Sincronizado';
  if(nubeEstado===NUBE_SIN)return'Sin conexión';
  if(nubeEstado===NUBE_PENDIENTE)return'Pendiente';
  if(nubeEstado===NUBE_SUBIENDO)return'Subiendo';
  if(nubeEstado===NUBE_CONFLICTO)return'Conflicto';
  return'Error';
}

function nubeDetalleTexto(){
  if(nubeDetalle)return nubeDetalle;
  if(nubeEstado===NUBE_LIMPIO)return'Documento al día en la nube';
  if(nubeEstado===NUBE_SIN)return'Los cambios se guardan aquí y se subirán al volver la red';
  if(nubeEstado===NUBE_CONFLICTO)return'Otro dispositivo guardó cambios primero';
  if(nubeEstado===NUBE_PENDIENTE)return'Esperando para subir';
  if(nubeEstado===NUBE_SUBIENDO)return'Enviando cambios';
  return'Aún no se ha conectado con la nube';
}

function nubeAviso(mensaje){
  if(typeof notify==='function')notify(mensaje);
}

/* ── marcado de cambios pendientes ───────────────────────────────────────── */

function nubeMarcarSucio(){
  if(nubeCallada)return;
  if(nubeEstado===NUBE_CONFLICTO)return;
  nubeSucio=true;
  // Se persiste en el acto, no al subir: así una pestaña cerrada a tiempo no pierde nada.
  sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:true});
  if(nubeEstado!==NUBE_SUBIENDO)nubeEstablecer(NUBE_PENDIENTE);
  nubeProgramar();
}

function nubeProgramar(){
  if(nubeTemporizador)clearTimeout(nubeTemporizador);
  nubeTemporizador=setTimeout(()=>{nubeTemporizador=null;nubeSubir()},NUBE_RETRASO);
}

/* ── subida ──────────────────────────────────────────────────────────────── */

async function nubeSubir(){
  if(nubeSubiendo||!nubeSucio)return;
  /* El orden importa para el aviso que ve la persona. Antes se comprobaba `nubeId` y se
   * salía sin decir nada, con lo que el panel se quedaba en «Guardando» para siempre
   * cuando no había sesión. Ahora primero se averigua por qué no se puede subir. */
  if(!nubeHayRed()){nubeEstablecer(NUBE_SIN);return}
  if(!(await sbToken())){nubeEstablecer(NUBE_SIN,'sin sesión');return}
  if(!nubeId){nubeEstablecer(NUBE_ESPERA,'todavía no hay documento en la nube');return}

  nubeSubiendo=true;
  nubeEstablecer(NUBE_SUBIENDO);
  try{
    const r=await sbGuardarDocumento(nubeInstantanea(),nubeRev,nubeId);
    if(r.conflicto){
      /* Otro dispositivo escribió primero. Se detiene todo: seguir insisting
       * destruiría una de las dos versiones. */
      try{nubeConflicto=await sbLeerDocumento()}catch(e){nubeConflicto=null}
      nubeEstablecer(NUBE_CONFLICTO);
      nubeAviso('Se detectaron cambios de otro dispositivo. Revisa Mantenimiento para elegir cuál conservar.');
      return;
    }
    nubeRev=r.rev;
    nubeSucio=false;
    sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
    nubeEstablecer(NUBE_LIMPIO);
  }catch(e){
    nubeEstablecer(sbEsFalloRed(e)?NUBE_SIN:NUBE_ERROR,e.message);
    if(!sbEsFalloRed(e))console.error('Supabase: error al guardar',e);
  }finally{
    nubeSubiendo=false;
  }
}

/* ── arranque ────────────────────────────────────────────────────────────── */

/* Sustituye el estado en memoria por el de la nube. Se silencia el marcado de
 * pendientes porque aquí no hay ningún cambio del usuario. */
function nubeHidratar(data){
  nubeCallada=true;
  try{
    db=Object.assign(db,data||{});
    normalizarDb();
  }finally{
    nubeCallada=false;
  }
}

/**
 * Conecta, decide de quién es el documento y deja la app lista. Nunca lanza: si la
 * nube falla, la app arranca igual con los datos locales, que es justamente lo que
 * permite trabajar sin conexión.
 */
async function nubeConectar(){
  if(!(await sbToken())){nubeEstablecer(NUBE_SIN,'sin sesión');return}
  if(!nubeHayRed()){nubeEstablecer(NUBE_SIN,'sin conexión al abrir');return}

  let remoto=null;
  try{
    remoto=await sbLeerDocumento();
  }catch(e){
    nubeEstablecer(sbEsFalloRed(e)?NUBE_SIN:NUBE_ERROR,e.message);
    return;
  }

  const meta=sbLeerMeta();
  const pendiente=!!(meta&&meta.sucio);
  const revConocido=meta?Number(meta.rev)||0:0;

  /* Había cambios locales sin subir. Si además la nube está en otra versión, otro
   * dispositivo escribió mientras este no tenía red: conflicto. */
  if(pendiente&&remoto&&remoto.rev!==revConocido){
    nubeId=remoto.id;
    nubeRev=remoto.rev;
    nubeConflicto=remoto;
    nubeSucio=true;
    nubeEstablecer(NUBE_CONFLICTO);
    return;
  }

  /* Cambios locales pendientes y la nube sigue donde se dejó: se reenvían. Es la vía
   * de recuperación de una subida que se interrumpió al cerrar la pestaña. */
  if(pendiente){
    try{
      if(remoto){
        const r=await sbGuardarDocumento(nubeInstantanea(),remoto.rev,remoto.id);
        if(r.conflicto){nubeConflicto=remoto;nubeId=remoto.id;nubeRev=remoto.rev;nubeEstablecer(NUBE_CONFLICTO);return}
        nubeId=remoto.id;
        nubeRev=r.rev;
      }else{
        const c=await sbCrearDocumento(nubeInstantanea());
        nubeId=c.id;
        nubeRev=c.rev;
      }
      nubeSucio=false;
      sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
      nubeEstablecer(NUBE_LIMPIO);
    }catch(e){
      nubeEstablecer(sbEsFalloRed(e)?NUBE_SIN:NUBE_ERROR,e.message);
    }
    return;
  }

  /* Sin nada pendiente: la nube manda y se adopta su versión. */
  if(remoto){
    nubeId=remoto.id;
    nubeRev=remoto.rev;
    nubeSucio=false;
    sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
    nubeHidratar(remoto.data);
    nubeEstablecer(NUBE_LIMPIO);
    return;
  }

  /* Proyecto nuevo: se crea el documento con lo que haya en este dispositivo. */
  try{
    const c=await sbCrearDocumento(nubeInstantanea());
    nubeId=c.id;
    nubeRev=c.rev;
    nubeSucio=false;
    sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
    nubeEstablecer(NUBE_LIMPIO);
  }catch(e){
    nubeEstablecer(sbEsFalloRed(e)?NUBE_SIN:NUBE_ERROR,e.message);
  }
}

/* ── resolución de conflictos ────────────────────────────────────────────── */

async function nubeResolver(modo){
  const remoto=nubeConflicto;
  if(!remoto)return;

  if(modo==='nube'){
    nubeHidratar(remoto.data);
    persistirLocal();
    nubeConflicto=null;
    nubeSucio=false;
    /* Sin esto el metadato local seguiría diciendo «pendiente» con el rev viejo: al
     * arrancar otra vez, la app compararía ese rev contra el de la nube, vería que no
     * cuadran y anunciaría un conflicto que ya está resuelto. */
    sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
    nubeEstablecer(NUBE_LIMPIO);
    renderAllAfterDataChange();
    nubeAviso('Se adoptó la versión de la nube.');
    return;
  }

  /* Este dispositivo manda: se reescribe sobre el rev que hay ahora en la nube, no
   * sobre el nuestro, porque el nuestro ya no existe. */
  nubeId=remoto.id;
  nubeRev=remoto.rev;
  nubeConflicto=null;
  nubeSucio=true;
  sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:true});
  await nubeSubir();
  renderAllAfterDataChange();
}

/* ── operaciones destructivas ────────────────────────────────────────────── */

/** Vacía el documento en la nube y deja el de este dispositivo como nueva base. */
async function nubeRestablecer(){
  if(nubeId){
    try{await sbBorrarDocumento(nubeId)}catch(e){
      if(!sbEsFalloRed(e)){nubeAviso('No se pudo borrar en la nube: '+(e.message||e));return false}
    }
  }
  nubeConflicto=null;
  try{
    const c=await sbCrearDocumento(nubeInstantanea());
    nubeId=c.id;
    nubeRev=c.rev;
    nubeSucio=false;
    sbGuardarMeta({id:nubeId,rev:nubeRev,sucio:false});
    nubeEstablecer(NUBE_LIMPIO);
    return true;
  }catch(e){
    nubeEstablecer(sbEsFalloRed(e)?NUBE_SIN:NUBE_ERROR,e.message);
    return false;
  }
}

/** Tras restaurar una copia local hay que subirla, o la nube la pisaría al siguiente
 *  arranque con la versión anterior. Como el usuario ha elegido esos datos
 *  explícitamente, se fuerza la subida aunque hubiera un conflicto pendiente. */
async function nubeSubirRestauracion(){
  nubeConflicto=null;
  if(nubeId){
    nubeSucio=true;
    await nubeSubir();
    return;
  }
  await nubeConectar();
}

/* Al recuperar la red se reintenta lo pendiente: guardar el cambio mientras no hay
 * conexión es el caso normal, no una excepción. */
if(typeof window!=='undefined'){
  window.addEventListener('online',()=>{if(nubeSucio)nubeSubir()});
}