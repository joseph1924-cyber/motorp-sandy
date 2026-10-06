/* Acceso a la nube y arranque — Moto Repuesto Sandy.
 *
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 *
 * Está separado de js/nucleo/nube.js a propósito: el motor de sincronización no
 * debería saber nada del formulario. Aquí solo se traduce entre la pantalla y el motor.
 *
 * La capa de acceso aparece únicamente cuando no hay sesión válida. Con la sesión
 * guardada, abrir la app es tan rápido como antes de añadir la nube: el token se
 * renueva en segundo plano y el documento se descarga mientras el usuario ya está
 * trabajando.
 */

function accesoMostrar(){
  const c=$('acceso');
  if(c)c.classList.add('abierta');
  /* La app se oculta por CSS con esta clase. Antes quedaba dibujada detrás del login, así
   * que se podía tabular hasta el contenido con la pantalla de acceso abierta. */
  document.body.classList.add('acceso-activo');
  const correo=$('acceso-correo');
  if(correo)setTimeout(()=>correo.focus(),50);
}

function accesoOcultar(){
  const c=$('acceso');
  if(c)c.classList.remove('abierta');
  document.body.classList.remove('acceso-activo');
  accesoClave(false);
  const e=$('acceso-error');
  if(e)e.textContent='';
}

/** Muestra u oculta la contraseña. Un botón aparte se lee mejor que un icono pequeño, y
 *  al teclear en móvil no ayuda a recordar la clave. */
function accesoVerClave(){
  accesoClave(($('acceso-clave')?.type||'password')!=='text');
}

function accesoClave(visible){
  const c=$('acceso-clave');
  if(!c)return;
  c.type=visible?'text':'password';
  const b=document.querySelector('.acceso-ver');
  if(!b)return;
  b.textContent=visible?'Ocultar':'Ver';
  b.setAttribute('aria-pressed',String(visible));
  b.setAttribute('aria-label',(visible?'Ocultar':'Mostrar')+' contraseña');
}

function accesoError(mensaje){
  const e=$('acceso-error');
  if(e)e.textContent=mensaje||'';
}

async function accesoEnviar(){
  const correo=($('acceso-correo')?.value||'').trim();
  const clave=$('acceso-clave')?.value||'';
  if(!correo||!clave){accesoError('Escribe tu correo y contraseña.');return}
  accesoError('Comprobando…');
  try{
    await sbIniciarSesion(correo,clave);
    accesoOcultar();
    await accesoConectar();
  }catch(e){
    /* Un fallo de red aquí NO es un problema del usuario: no se le pide que revise la
     * contraseña si lo que falla es que no hay conexión. */
    accesoError(sbEsFalloRed(e)?'No hay conexión con la nube. Puedes trabajar sin conexión con los datos de este dispositivo.':e.message);
  }
}

function accesoSinConexion(){
  accesoOcultar();
  const s=sbLeerMeta();
  if(s&&s.sucio)nubeAviso('Hay cambios sin subir. Se enviarán en cuanto vuelva la conexión.');
}

/** Cierra la sesión en este dispositivo. No borra nada: ni local ni en la nube. */
function accesoSalir(){
  if(typeof confirm==='function'&&!confirm('Se cerrará la sesión en este dispositivo. Los datos locales se conservan y los cambios pendientes dejarán de subirse hasta que vuelvas a entrar.'))return;
  sbCerrarSesion();
  sbOlvidarMeta();
  nubeId=null;
  nubeRev=0;
  nubeSucio=false;
  nubeConflicto=null;
  nubeEstablecer(NUBE_SIN,'sesión cerrada en este dispositivo');
  if(typeof renderMantenimiento==='function')renderMantenimiento();
  accesoMostrar();
}

/** Tras entrar, conecta y adopta el documento de la nube si hay uno. */
async function accesoConectar(){
  const antes=nubeInstantanea();
  await nubeConectar();
  if(JSON.stringify(antes)!==JSON.stringify(db))renderAllAfterDataChange();
  if(typeof renderMantenimiento==='function')renderMantenimiento();
}

/**
 * Punto de entrada del arranque. Devuelve `{hidratado:true}` si el documento venía de
 * la nube y difiere de lo que había en local, para que main.js sepa si debe repintar.
 *
 * Nunca lanza: si la nube no está disponible la app arranca igual con los datos
 * locales. Trabajar sin conexión es un modo de funcionamiento normal, no un error.
 */
async function accesoNube(){
  try{
    if(!(await sbToken())){
      accesoMostrar();
      return null;
    }
    const antes=nubeInstantanea();
    await nubeConectar();
    return JSON.stringify(antes)!==JSON.stringify(db)?{hidratado:true}:null;
  }catch(e){
    console.error('Supabase: fallo al conectar, se sigue con los datos locales',e);
    nubeEstablecer(NUBE_SIN,e.message);
    return null;
  }
}