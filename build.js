#!/usr/bin/env node
/**
 * Moto Repuesto Sandy — utilidades de construcción.
 *
 *   node build.js              genera dist/moto-repuesto-sandy.html
 *   node build.js --verificar  comprueba que los módulos no perdieron código
 *                              respecto al archivo original de reference/
 *
 * Sin dependencias: solo módulos nativos de Node.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = __dirname;
const ORIGEN_HTML = path.join(RAIZ, 'index.html');
const DIR_DIST = path.join(RAIZ, 'dist');
const NOMBRE_DIST = 'moto-repuesto-sandy.html';

/** Lee el archivo HTML monolítico de referencia dentro de original/. */
function leerOriginal() {
  const dir = path.join(RAIZ, 'original');
  if (!fs.existsSync(dir)) return null;
  const archivo = fs.readdirSync(dir).find((f) => f.endsWith('.html'));
  return archivo ? path.join(dir, archivo) : null;
}

/** Extrae del index.html actual las hojas de estilo y los scripts, en orden. */
function leerModulos() {
  const html = fs.readFileSync(ORIGEN_HTML, 'utf8');
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  const js = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  if (!css.length || !js.length) throw new Error('index.html no declara hojas de estilo ni scripts.');
  const faltante = [...css, ...js].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  if (faltante.length) throw new Error('Archivos referenciados que no existen:\n  ' + faltante.join('\n  '));
  return { html, css, js };
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción del archivo único
// ─────────────────────────────────────────────────────────────────────────────

function construir() {
  const { html, css, js } = leerModulos();

  const cssInline = css
    .map((ruta) => `/* ${ruta} */\n` + fs.readFileSync(path.join(RAIZ, ruta), 'utf8').trim())
    .join('\n');

  const jsInline = js
    .map((ruta) => fs.readFileSync(path.join(RAIZ, ruta), 'utf8').trim())
    .join('\n\n');

  // Sustituye el bloque de <link> por el CSS inlineado.
  let salida = html.replace(/^[ \t]*<link rel="stylesheet" href="[^"]+">\n/gm, '');

  // OJO: el reemplazo es una FUNCIÓN a propósito. Si fuera una cadena, `String.replace`
  // interpretaría las secuencias $&, $', $` y $1..$99 que abundantemente aparecen en el
  // código (plantillas ${...}) y reintroduciría marcadores de forma silenciosa.
  salida = salida.replace('</head>', () => `<style>\n${cssInline}\n</style>\n</head>`);

  for (const ruta of js) {
    const marca = `<script src="${ruta}"></script>`;
    const codigo = fs.readFileSync(path.join(RAIZ, ruta), 'utf8').trim();
    if (!salida.includes(marca)) throw new Error('No se encontró la marca ' + marca);
    salida = salida.replace(marca, () => `<script>\n${codigo}\n</script>`);
  }

  // Comprobaciones de que no quedó ninguna referencia externa sin resolver.
  const residuales = [];
  if (/<link\s+rel="stylesheet"/.test(salida)) residuales.push('<link rel="stylesheet">');
  if (/<script\s+src=/.test(salida)) residuales.push('<script src=>');
  const nScripts = (salida.match(/<script>/g) || []).length;
  if (nScripts !== js.length) residuales.push(`<script> inline: ${nScripts}, esperado ${js.length}`);
  if (residuales.length) throw new Error('Marcadores sin resolver en el archivo único: ' + residuales.join(', '));

  fs.mkdirSync(DIR_DIST, { recursive: true });
  const destino = path.join(DIR_DIST, NOMBRE_DIST);
  fs.writeFileSync(destino, salida, 'utf8');

  const kb = (Buffer.byteLength(salida, 'utf8') / 1024).toFixed(1);
  console.log(`Generado ${path.relative(RAIZ, destino)}  (${kb} KB, ${css.length} hojas + ${js.length} módulos)`);
  return destino;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificación de integridad
// ─────────────────────────────────────────────────────────────────────────────

/** Trocea CSS en reglas de nivel superior, respetando cadenas y comentarios. */
function reglasCss(texto) {
  const salida = [];
  let prof = 0, inicio = 0, comilla = null, comentario = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i], n = texto[i + 1];
    if (comentario) { if (c === '*' && n === '/') { comentario = false; i++; } continue; }
    if (comilla) { if (c === '\\') { i++; continue; } if (c === comilla) comilla = null; continue; }
    if (c === '/' && n === '*') { comentario = true; i++; continue; }
    if (c === '"' || c === "'") { comilla = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) { salida.push(texto.slice(inicio, i + 1).trim()); inicio = i + 1; } }
  }
  const cola = texto.slice(inicio).trim();
  if (cola) salida.push(cola);
  return salida;
}

const sinEspacios = (s) => String(s).replace(/\s+/g, '');

/** Multiconjunto de elementos normalizados, con recuento de repeticiones. */
function multiconjunto(elementos) {
  const mapa = new Map();
  for (const e of elementos) {
    const k = sinEspacios(e);
    if (!k) continue;
    mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  return mapa;
}

/** Resta una lista de líneas de un multiconjunto, ignorando las que no estén. */
function restar(mapa, elementos) {
  const copia = new Map(mapa);
  for (const e of elementos) {
    const k = sinEspacios(e);
    const n = copia.get(k);
    if (n) copia.set(k, n - 1);
  }
  return copia;
}

/** Compara dos multiconjuntos y devuelve el exceso de cada elemento, no su recuento. */
function comparar(mapaA, mapaB) {
  const faltan = [...mapaA].map(([k, v]) => [k, v - (mapaB.get(k) || 0)]).filter(([, d]) => d > 0);
  const sobran = [...mapaB].map(([k, v]) => [k, v - (mapaA.get(k) || 0)]).filter(([, d]) => d > 0);
  return { faltan, sobran };
}

/* Los cambios deliberados de la Fase 0 están declarados en original/cambios-fase0.js.
 * Verificar que ese manifiesto sea fiel a sí mismo evita que quede desactualizado. */
const MANIFIESTO = require(path.join(RAIZ, 'original', 'cambios-fase0.js')).cambios;

function verificarManifiesto(ok) {
  console.log('\nMANIFIESTO DE CAMBIOS INTENCIONALES');
  const sinMotivo = MANIFIESTO.filter((c) => !c.motivo || !c.archivo);
  ok('cada cambio declara archivo y motivo', sinMotivo.length === 0,
    sinMotivo.length ? `${sinMotivo.length} entradas incompletas` : `${MANIFIESTO.length} cambios`);
  ok('queda registrado en git', fs.existsSync(path.join(RAIZ, 'original', 'cambios-fase0.js')));
}

function verificar() {
  const original = leerOriginal();
  if (!original) {
    console.error('No se encontró el archivo original en original/. Se omite la verificación.');
    return 1;
  }

  const { css, js } = leerModulos();
  const L = fs.readFileSync(original, 'utf8').split('\n');
  let fallos = 0;
  const ok = (etiqueta, condicion, detalle = '') => {
    console.log(`  ${condicion ? '✅' : '❌'} ${etiqueta}${detalle ? '  ' + detalle : ''}`);
    if (!condicion) fallos++;
  };

  // Localiza el <style> y el <script> del original.
  const lineaStyle = L.findIndex((l) => l.trim() === '<style>');
  const lineaScript = L.findIndex((l) => l.trim() === '<script>');
  // El CSS termina en la línea que cierra </style>; el JS, en la que cierra </script>.
  const finCss = L.findIndex((l, i) => i > lineaStyle && l.includes('</style>'));
  const finJs = L.findIndex((l, i) => i > lineaScript && l.includes('</script>'));
  if (lineaStyle < 0 || lineaScript < 0 || finCss < 0 || finJs < 0)
    throw new Error('El original no tiene <style>/<script> con la estructura esperada.');

  console.log('\nCSS');
  const cssOriginal = reglasCss(L.slice(lineaStyle + 1, finCss + 1).join('\n').replace(/<\/style>\s*$/, ''));
  const cssNuevo = css.flatMap((ruta) =>
    reglasCss(fs.readFileSync(path.join(RAIZ, ruta), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''))
  );
  const difCss = comparar(multiconjunto(cssOriginal), multiconjunto(cssNuevo));
  ok('mismo número de reglas', cssOriginal.length === cssNuevo.length,
    `original ${cssOriginal.length} · nuevo ${cssNuevo.length}`);
  ok('ninguna regla perdida', difCss.faltan.length === 0);
  ok('ninguna regla inventada', difCss.sobran.length === 0);
  let ordenInterno = true;
  css.forEach((ruta) => {
    const rs = reglasCss(fs.readFileSync(path.join(RAIZ, ruta), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
    let prev = -1;
    for (const r of rs) {
      const idx = cssOriginal.findIndex((x) => sinEspacios(x) === sinEspacios(r));
      if (idx <= prev) { ordenInterno = false; break; }
      prev = idx;
    }
  });
  ok('orden original preservado dentro de cada archivo', ordenInterno);

  console.log('\nJS');
  const jsOriginalBruto = L.slice(lineaScript + 1, finJs + 1).map((l) => l.replace(/<\/script>\s*$/, ''));

  // Cambio intencionado: la IIFE de recuperación pasa a función nombrada.
  const i0 = jsOriginalBruto.findIndex((l) => l.trim().startsWith('(async function recoverLoanDataFromIndexedDB(){'));
  const i1 = jsOriginalBruto.findIndex((l, i) => i > i0 && l.trim().startsWith('})();'));
  const lineas = jsOriginalBruto.slice();
  lineas[i0] = lineas[i0].replace('(async function recoverLoanDataFromIndexedDB(){', 'async function recoverLoanDataFromIndexedDB(){');
  lineas[i1] = ' recoverLoanDataFromIndexedDB();' + lineas[i1].slice(lineas[i1].indexOf('notify('));

  // Comprobación por multiconjunto de LÍNEAS: independiente de los límites de bloque,
  // así que detecta cualquier línea perdida, alterada o duplicada.
  const lineasNuevas = js.flatMap((ruta) =>
    fs.readFileSync(path.join(RAIZ, ruta), 'utf8')
      .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
      .split('\n')
  );

  verificarManifiesto(ok);

  // El manifiesto describe diferencias deliberadas: primero se comprueba que cada línea
  // «quita» estaba realmente en el original y cada «agrega» está realmente en el código
  // nuevo. Si el manifiesto queda viejo, falla aquí en vez de dar un falso verde.
  const quitaJs = MANIFIESTO.filter((c) => c.archivo.endsWith('.js')).flatMap((c) => c.quita);
  const agregaJs = MANIFIESTO.filter((c) => c.archivo.endsWith('.js')).flatMap((c) => c.agrega);
  const setOriginal = multiconjunto(lineas);
  const setNuevo = multiconjunto(lineasNuevas);

const quitaAusente = quitaJs.filter((l) => sinEspacios(l) && !setOriginal.get(sinEspacios(l)));
  const agregaAusente = agregaJs.filter((l) => sinEspacios(l) && !setNuevo.get(sinEspacios(l)));
  ok('el manifiesto sigue correspondiendo al original', quitaAusente.length === 0,
    quitaAusente.slice(0, 2).map((l) => l.slice(0, 60)).join(' | '));
  ok('el manifiesto sigue correspondiendo al código actual', agregaAusente.length === 0,
    agregaAusente.slice(0, 2).map((l) => l.slice(0, 60)).join(' | '));

  /* Las líneas en blanco no entran en el multiconjunto, así que se filtran del manifiesto
   * antes de aplicarlo para no descuadrar los recuentos. */
  const quitaAplicada = quitaJs.filter((l) => sinEspacios(l));
  const agregaAplicada = agregaJs.filter((l) => sinEspacios(l));
  const difLineas = comparar(restar(setOriginal, quitaAplicada), restar(setNuevo, agregaAplicada));
  ok('ninguna línea de código perdida', difLineas.faltan.length === 0,
    difLineas.faltan.slice(0, 3).map(([k]) => k.slice(0, 70)).join(' | '));
  const llaves = difLineas.sobran.filter(([k]) => k === '}');
  const otros = difLineas.sobran.filter(([k]) => k !== '}');
  ok('ninguna línea alterada ni duplicada', otros.length === 0,
    otros.slice(0, 3).map(([k]) => k.slice(0, 70)).join(' | '));
  ok('única diferencia: la llave de cierre de la IIFE convertida',
    llaves.length === 1 && llaves[0][1] === 1, `encontradas ${llaves.length}`);

  /* Declaraciones y funciones: el original no puede perder ninguna, y todo lo que aparezca
   * de más tiene que estar en el manifiesto. Como una línea modificada vuelve a nombrar su
   * propia función, «nueva» significa «no existía en el original», no «no aparece en las
   * líneas agregadas». Por eso se comparan multiconjuntos de los sobrantes. */
  const textoNuevo = lineasNuevas.join('\n');
  const decl = (t) => [...t.matchAll(/(?:^|\n)(?:async\s+function|function|const|let|var)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
  const nombres = (t) => [...t.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)].map((m) => m[1]);

  const setOrigDecl = multiconjunto(decl(lineas.join('\n')));
  const setNuevoDecl = multiconjunto(decl(textoNuevo));
  const declaradas = decl(agregaAplicada.join('\n')).filter((n) => !setOrigDecl.get(n));
  const sobranDecl = comparar(setOrigDecl, setNuevoDecl).sobran.map(([n]) => n);

  ok('ninguna declaración perdida', comparar(setOrigDecl, setNuevoDecl).faltan.length === 0,
    comparar(setOrigDecl, setNuevoDecl).faltan.map(([n]) => n).join(', '));
  ok('toda declaración nueva está registrada en el manifiesto',
    comparar(multiconjunto(declaradas), multiconjunto(sobranDecl)).faltan.length === 0 &&
      comparar(multiconjunto(declaradas), multiconjunto(sobranDecl)).sobran.length === 0,
    `esperadas ${declaradas.join(', ') || '—'} · encontradas ${sobranDecl.join(', ') || '—'}`);

  const setOrigFn = multiconjunto(nombres(lineas.join('\n')));
  const setNuevoFn = multiconjunto(nombres(textoNuevo));
  const difFn = comparar(setOrigFn, setNuevoFn);
  const fnDeclaradas = nombres(agregaAplicada.join('\n')).filter((n) => !setOrigFn.get(n));
  const sobranFn = difFn.sobran.map(([n]) => n);
  const difFnNuevas = comparar(multiconjunto(fnDeclaradas), multiconjunto(sobranFn));

  ok('ninguna función perdida', difFn.faltan.length === 0, difFn.faltan.map(([n]) => n).join(', '));
  ok('toda función nueva está registrada en el manifiesto',
    difFnNuevas.faltan.length === 0 && difFnNuevas.sobran.length === 0,
    `esperadas ${fnDeclaradas.join(', ') || '—'} · encontradas ${sobranFn.join(', ') || '—'}`);

  console.log('\nHTML');
  const htmlActual = fs.readFileSync(ORIGEN_HTML, 'utf8');
  const cuerpoOriginal = sinEspacios(L.slice(L.findIndex((l) => l.trim() === '<body>'), L.findIndex((l) => l.trim() === '<script>')).join('\n'));
  let cuerpoNuevo = sinEspacios(htmlActual.match(/<body>[\s\S]*?(?=<script src=)/)[0]);
  /* Se aplica al original cada sustitución de texto registrada, para comparar el cuerpo
   *resultante contra el que hay hoy en lugar de exigir que nunca cambie. */
  const cambiosHtml = MANIFIESTO.filter((c) => c.archivo.endsWith('.html'));
  let htmlAplicado = cuerpoOriginal;
  for (const c of cambiosHtml) {
    for (let i = 0; i < c.quita.length; i++) {
      const a = sinEspacios(c.quita[i]), b = sinEspacios(c.agrega[i] ?? '');
      if (a && htmlAplicado.includes(a)) htmlAplicado = htmlAplicado.replace(a, () => b);
    }
  }
  ok('cuerpo del documento intacto salvo cambios declarados', htmlAplicado === cuerpoNuevo);
  ok('todo cambio de HTML está registrado en el manifiesto', cambiosHtml.length === MANIFIESTO.filter((c) => !c.archivo.endsWith('.js')).length);
  ok('el script de arranque va al final', /<script src="js\/main\.js"><\/script>/.test(htmlActual));

  console.log(fallos === 0 ? '\nVERIFICACIÓN CORRECTA ✅' : `\n${fallos} VERIFICACIONES FALLIDAS ❌`);
  return fallos === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────

const raiz = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (raiz.length) {
  console.error('Uso: node build.js [--verificar]');
  process.exit(2);
}
if (process.argv.includes('--verificar')) {
  process.exit(verificar());
}
construir();