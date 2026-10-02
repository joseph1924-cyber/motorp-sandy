/* Arranque de la aplicación
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor()})
load();reestablecerSecuenciaGO();reajustarSecuenciaPPR();securitySettings();initDates();nav();initCxpSubnav();$('cxp-subnav')?.classList.remove('open');$('cxp-arrow')?.classList.remove('open');updateBrand();renderDashboard();renderGestion('contado');renderGestion('credito');renderGestion('recibos');renderCxp();renderGastos();renderNomina();renderCronograma();renderEmpresa();renderMantenimiento();copyLocalToIndexedDB(false);
fillCxpReportAcreedores();clearEstadoCuentaResultado();
