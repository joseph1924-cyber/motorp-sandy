/* Entorno de pruebas — sin dependencias externas.
 * Carga los scripts clásicos en el mismo orden que index.html dentro de un contexto
 * vm con un DOM simulado, para poder ejecutar la lógica de negocio y el arranque.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* Orden real de los <script> de index.html. Debe mantenerse sincronizado con el HTML. */
const MODULOS = [
  'js/nucleo/almacen.js',
  'js/nucleo/utiles.js',
  'js/nucleo/secuencias.js',
  'js/nucleo/config-supabase.js',
  'js/nucleo/supabase.js',
  'js/nucleo/nube.js',
  'js/nucleo/idb.js',
  'js/nucleo/respaldo.js',
  'js/nucleo/respaldo-almacen.js',
  'js/dominio/ventas.js',
  'js/dominio/resultados.js',
  'js/dominio/acreedores.js',
  'js/dominio/prestamos.js',
  'js/dominio/pagos-prestamo.js',
  'js/dominio/obligaciones.js',
  'js/dominio/cxp.js',
  'js/dominio/cxp-reportes.js',
  'js/dominio/pagos-suplidor.js',
  'js/dominio/gastos.js',
  'js/dominio/nomina.js',
  'js/dominio/cronograma.js',
  'js/dominio/empresa.js',
  'js/ui/navegacion.js',
  'js/ui/editor.js',
  'js/ui/impresion.js',
  'js/ui/nube-acceso.js',
  'js/main.js',
];

/* Elemento simulado. No busca nada de verdad: cualquier consulta devuelve un elemento
 * vacío, suficiente para que el arranque no lance ReferenceError. Lo que se verifica
 * son los valores asignados (innerHTML, textContent, value). */
class El {
  constructor(id = '') {
    this.id = id;
    this.tagName = 'DIV';
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.children = [];
    this.dataset = {};
    this.style = new Proxy({}, { get: () => '', set: () => true });
    this.classList = {
      _s: new Set(),
      add: (...c) => c.forEach((x) => this.classList._s.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._s.delete(x)),
      toggle: (c, on) => (on ? this.classList._s.add(c) : this.classList._s.delete(c)),
      contains: (c) => this.classList._s.has(c),
    };
  }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  remove() {}
  setAttribute() {}
  getAttribute() { return ''; }
  addEventListener() {}
  removeEventListener() {}
  closest() { return null; }
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  getElementsByTagName() { return []; }
  insertAdjacentHTML(_p, html) { this.innerHTML += html; }
  click() {}
  focus() {}
  print() {}
  matches() { return false; }
  get firstChild() { return this.children[0] ?? null; }
}

/* Formatea lo que el código pasa a innerHTML para poder afirmar sobre el texto. */
function textoDe(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function crearAlmacen(opts = {}) {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
    clear: () => datos.clear(),
    __datos: datos,
  };
}

function crearContexto(extra = {}) {
  const elementos = new Map();
  const porId = (id) => {
    if (!elementos.has(id)) elementos.set(id, new El(id));
    return elementos.get(id);
  };
  const almacenamiento = crearAlmacen();
  const avisos = [];
  const errores = [];

  const document = {
    getElementById: porId,
    querySelector: (sel) => (sel.startsWith('#') ? porId(sel.slice(1)) : new El(sel)),
    querySelectorAll: () => [],
    createElement: (tag) => new El(tag),
    addEventListener: () => {},
    body: new El('body'),
    title: '',
    cookie: '',
  };

  const ctx = {
    console,
    document,
    localStorage: almacenamiento,
    sessionStorage: crearAlmacen(),
    indexedDB: undefined,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => fn(),
    alert: (m) => avisos.push(String(m)),
    confirm: () => true,
    prompt: () => '',
    fetch: () => Promise.reject(new Error('sin red en pruebas')),
    navigator: { userAgent: 'node', onLine: false, clipboard: { writeText: () => Promise.resolve() } },
    location: { href: 'https://ejemplo.test/', origin: 'https://ejemplo.test', protocol: 'https:' },
    history: { replaceState: () => {} },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    Blob: class { constructor(p) { this.size = String(p[0] ?? '').length; } },
    FileReader: class { readAsDataURL() {} addEventListener() {} },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    FormData: class { constructor() { this.d = {}; } append(k, v) { this.d[k] = v; } },
    crypto: { randomUUID: () => 'id-fijo-0000-0000-0000-000000000000' },
    /* atob existe siempre en un navegador y sbExpiracion() lo usa para leer el exp del
     * token. Se acepta base64url porque los JWT lo usan. */
    atob: (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary'),
    Intl,
    __avisos: avisos,
    __errores: errores,
    __elementos: elementos,
    __almacenamiento: almacenamiento,
    ...extra,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  /* window en un navegador registra oyentes de eventos. El motor de sincronización se
   * engancha al evento `online` para reintentar la subida al recuperar la red, así que
   * el simulador necesita la forma, aunque aquí no se dispare ningún evento. */
  ctx.__oyentes = new Map();
  ctx.addEventListener = (tipo, fn) => {
    if (!ctx.__oyentes.has(tipo)) ctx.__oyentes.set(tipo, []);
    ctx.__oyentes.get(tipo).push(fn);
  };
  ctx.removeEventListener = (tipo, fn) => {
    const l = ctx.__oyentes.get(tipo);
    if (l) ctx.__oyentes.set(tipo, l.filter((f) => f !== fn));
  };
  ctx.dispatchEvent = (ev) => (ctx.__oyentes.get(ev?.type) || []).forEach((f) => f(ev));
  const vmCtx = vm.createContext(ctx);
  /* Atajo para sembrar datos: los tests fijan tablas completas sin pasar por JSON. */
  ctx.ponerDatos = (parcial) => {
    const actual = dbDe(vmCtx);
    vm.runInContext(`db = ${JSON.stringify({ ...actual, ...parcial })}`, vmCtx);
  };
  return vmCtx;
}

/* Carga los módulos indicados (por defecto todos) y devuelve el contexto. */
function cargar(modulos = MODULOS, extra = {}) {
  const ctx = crearContexto(extra);
  for (const m of modulos) {
    const ruta = path.join(RAIZ, m);
    const codigo = fs.readFileSync(ruta, 'utf8');
    try {
      vm.runInContext(codigo, ctx, { filename: m });
    } catch (e) {
      throw new Error(`No se pudo cargar ${m}: ${e.message}`);
    }
  }
  return ctx;
}

/* Extrae del HTML el orden de los <script src="js/..."> y lo compara con MODULOS,
 * para que nadie añada un módulo al HTML sin actualizar el arnés. */
function ordenDeHtml() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
}

/* notify() no usa alert: escribe en #toast. Este helper centraliza su lectura. */
function ultimoAviso(ctx) {
  return String(ctx.document.getElementById('toast')?.textContent ?? '');
}

/* `let db` en almacen.js queda en el ámbito léxico del contexto, no como propiedad del
 * sandbox, así que hay que leerlo y reasignarlo evaluando expresiones en el contexto. */
function dbDe(ctx) {
  return vm.runInContext('db', ctx);
}

/* Lee una expresión en el contexto. `let` y `const` de los módulos viven en el ámbito
 * léxico del vm y no son propiedades del sandbox, así que no hay otra forma de verlos:
 * es lo que permite comprobar el estado del motor de sincronización. */
function leer(ctx, expresion) {
  return vm.runInContext(expresion, ctx);
}

function ponerDb(ctx, valor) {
  vm.runInContext(`db = ${JSON.stringify(valor)}`, ctx);
  return dbDe(ctx);
}

module.exports = {
  RAIZ, MODULOS, El, crearContexto, cargar, ordenDeHtml, textoDe, ultimoAviso, dbDe, ponerDb, leer,
};