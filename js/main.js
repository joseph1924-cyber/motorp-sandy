/* Arranque de la aplicación
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor()})

/* El arranque espera a la nube antes de pintar. El orden importa: si se pintara
 * primero y luego se descargara el documento, la primera vista mostraría los datos
 * locales y habría que redibujarla entera un instante después, con el riesgo de que un
 * clic en ese hueco editara la versión equivocada.
 *
 * Los datos locales se cargan ANTES de conectar porque son la respuesta inmediata y
 * además son la referencia que `accesoNube()` compara contra la nube para saber si
 * hubo que hidratar. */
let arranque={hidratado:false};

async function arrancar(){
  load();
  arranque=await accesoNube()||{hidratado:false};
  reestablecerSecuenciaGO();reajustarSecuenciaPPR();securitySettings();initDates();nav();initCxpSubnav();$('cxp-subnav')?.classList.remove('open');$('cxp-arrow')?.classList.remove('open');updateBrand();renderDashboard();renderGestion('contado');renderGestion('credito');renderGestion('recibos');renderCxp();renderGastos();renderNomina();renderCronograma();renderEmpresa();renderMantenimiento();copyLocalToIndexedDB(false);
  fillCxpReportAcreedores();clearEstadoCuentaResultado();
}

arrancar();
