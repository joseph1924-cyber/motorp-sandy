/* Pruebas de arranque, persistencia y render seguro.
 * El arranque es el punto critico: renderCxp() se llama 23 veces y antes fallaba por
 * una funcion ausente, con lo que la mitad de la interfaz nunca se dibujaba.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, MODULOS, ordenDeHtml, ultimoAviso, dbDe, textoDe } = require('./entorno.js');

const plain = (v) => JSON.parse(JSON.stringify(v));

test('el orden de los scripts del HTML coincide con el que carga el arnés', () => {
  assert.deepEqual(ordenDeHtml(), MODULOS,
    'al añadir o mover un <script src="js/..."> hay que actualizar MODULOS en test/entorno.js');
});

test('la aplicacion arranca completa sin lanzar excepciones', () => {
  /* Si algo falla, cargar() lanza. El arranque de main.js va incluido en MODULOS. */
  const ctx = cargar();
  assert.ok(ctx.renderCxp, 'renderCxp quedo definida');
});

test('fillCxpTerceros quedo definida: era lo que truncaba el arranque', () => {
  const ctx = cargar();
  assert.equal(typeof ctx.fillCxpTerceros, 'function',
    'renderCxp() la invoca; si falta, aborta y no se dibuja el resto de la interfaz');
});

test('fillCxpTerceros lista proveedores y acreedores no proveedores', () => {
  const ctx = cargar();
  const sel = ctx.document.getElementById('fx-tercero');
  sel.value = '';

  ctx.ponerDatos({
    suplidores: [{ id: 's1', codigo: 'SUP-001', nombre: 'Aceites del Norte' }],
    acreedores: [
      { id: 'a1', codigo: 'AC-001', nombre: 'Banco Popular', categoria: 'Banco' },
      { id: 'a2', codigo: 'AC-002', nombre: 'Inversion Delta', categoria: 'Proveedor' },
      { id: 'a3', codigo: 'AC-003', nombre: 'Aceites del Norte', categoria: 'Suplidor' },
    ],
  });
  ctx.fillCxpTerceros();

  const html = sel.innerHTML;
  assert.match(html, /value="sup:s1"/, 'incluye el proveedor');
  assert.match(html, /value="acr:a1"/, 'incluye el acreedor Banco');
  assert.match(html, /value="acr:a2"/, 'incluye el acreedor Proveedor');
  assert.ok(!html.includes('value="acr:a3"'),
    'el acreedor duplicado de categoria Suplidor no debe aparecer dos veces');
  assert.match(html, /Todos los terceros/);
});

test('fillCxpTerceros escapa los nombres de terceros', () => {
  const ctx = cargar();
  const sel = ctx.document.getElementById('fx-tercero');
  ctx.ponerDatos({
    suplidores: [],
    acreedores: [{ id: 'a1', codigo: 'AC-001', nombre: '<img src=x onerror=alert(1)>', categoria: 'Banco' }],
  });
  ctx.fillCxpTerceros();

  assert.ok(!/<img/.test(sel.innerHTML), 'no debe emitir HTML crudo del nombre');
  assert.match(sel.innerHTML, /&lt;img/);
});

test('fillCxpTerceros conserva la seleccion si el tercero sigue existiendo', () => {
  const ctx = cargar();
  const sel = ctx.document.getElementById('fx-tercero');
  ctx.ponerDatos({
    suplidores: [{ id: 's1', codigo: 'SUP-001', nombre: 'Aceites del Norte' }],
    acreedores: [],
  });
  sel.value = 'sup:s1';
  ctx.fillCxpTerceros();
  assert.equal(sel.value, 'sup:s1');
});

test('renderCxp no lanza con datos vacios y con datos reales', () => {
  const ctx = cargar();
  assert.doesNotThrow(() => ctx.renderCxp(), 'base vacia');
  ctx.ponerDatos({
    suplidores: [{ id: 's1', codigo: 'SUP-001', nombre: 'Aceites', rnc: '1-1', dias: 30 }],
    acreedores: [{ id: 'a1', codigo: 'AC-001', nombre: 'Banco', categoria: 'Banco', dias: 0 }],
    facturasSuplidor: [{ id: 'f1', suplidorId: 's1', acreedorId: 'a1', codigo: 'F-001', total: 1000, saldo: 400, fecha: '2026-01-10', vencimiento: '2026-02-10' }],
    prestamos: [],
    obligaciones: [],
  });
  assert.doesNotThrow(() => ctx.renderCxp(), 'con datos');
});

test('los nombres de terceros se escapan en todas las tablas de CxP', () => {
  const ctx = cargar();
  const XSS = '<img src=x onerror=alert(1)>';
  ctx.ponerDatos({
    suplidores: [{ id: 's1', codigo: 'SUP-001', nombre: XSS, rnc: XSS, dias: 30 }],
    acreedores: [{ id: 'a1', codigo: 'AC-001', nombre: XSS, categoria: XSS, rnc: XSS, dias: 0 }],
    facturasSuplidor: [{ id: 'f1', suplidorId: 's1', acreedorId: 'a1', documento: XSS, concepto: XSS, total: 1000, saldo: 400, fecha: '2026-01-10', vencimiento: '2026-02-10' }],
  });
  ctx.renderCxp();

  for (const id of ['tbl-facturas-cxp', 'tbl-acreedores', 'tbl-prestamos']) {
    const html = String(ctx.document.getElementById(id).innerHTML);
    assert.ok(!html.includes('<img src=x'), `${id} emitio HTML crudo`);
  }
});

test('los datos de empresa se escapan en la ficha y en la marca', () => {
  const ctx = cargar();
  const db = dbDe(ctx);
  db.empresa = { nombre: '<img src=x onerror=alert(1)>', eslogan: '<b>bold</b>', rnc: '1-1', margen: 30 };
  ctx.renderEmpresa();

  const ficha = String(ctx.document.getElementById('empresa-ficha').innerHTML);
  const marca = String(ctx.document.getElementById('brand').innerHTML);
  assert.ok(!ficha.includes('<img src=x'), 'la ficha de empresa emitio HTML crudo');
  assert.ok(!marca.includes('<img src=x'), 'la marca emitio HTML crudo');
  assert.match(ficha, /&lt;img/);
});

test('row() escapa el valor de los documentos imprimibles', () => {
  const ctx = cargar();
  const html = ctx.row('Nombre', '<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'), 'row() dejo pasar HTML crudo');
  assert.match(html, /&lt;img/);
  assert.match(html, /<b>Nombre<\/b>/, 'la etiqueta literal se mantiene intacta');
});

test('row() no altera numeros, fechas ni el guion largo', () => {
  const ctx = cargar();
  assert.equal(textoDe(ctx.row('Monto', 'RD$ 1,234.50')), 'MontoRD$ 1,234.50');
  assert.equal(textoDe(ctx.row('Fecha', '31/01/2026')), 'Fecha31/01/2026');
  assert.equal(textoDe(ctx.row('RNC', '—')), 'RNC—');
});

/* localStorage lleno: un objeto que siempre lanza QuotaExceededError. */
function localStorageLleno() {
  return {
    getItem: () => null,
    setItem: () => { throw Object.assign(new Error('quota superada'), { name: 'QuotaExceededError', code: 22 }); },
    removeItem: () => {},
  };
}

test('persistirLocal avisa y no propaga la excepcion si localStorage esta lleno', () => {
  /* Los stubs se asignan despues de cargar: si se pasan al sandbox, respaldo.js
   * sobrescribe scheduleDriveBackup() con la implementacion real. */
  const ctx = cargar();
  ctx.localStorage = localStorageLleno();

  assert.equal(ctx.persistirLocal(), false, 'debe reportar el fallo');
  assert.match(ultimoAviso(ctx), /No se pudo guardar/i);
  assert.match(ultimoAviso(ctx), /lleno/i, 'debe explicar la causa al usuario');
});

test('save() sobrevive a localStorage lleno y aun asi programa el respaldo', () => {
  const ctx = cargar();
  ctx.localStorage = localStorageLleno();
  let respaldos = 0;
  ctx.scheduleDriveBackup = () => { respaldos++; };

  assert.doesNotThrow(() => ctx.save(), 'save no debe propagar la excepcion');
  assert.equal(respaldos, 1, 'el respaldo de Drive debe programarse igual');
});

test('save() no pierde el espejo en IndexedDB aunque localStorage falle', () => {
  const ctx = cargar();
  ctx.localStorage = localStorageLleno();
  let escrituras = 0;
  ctx.idbPutState = () => { escrituras++; return Promise.resolve(); };

  ctx.save();
  assert.equal(escrituras, 1, 'IndexedDB se escribe aunque localStorage falle');
});

test('saveWithoutDrive() tambien sobrevive y no programa respaldo', () => {
  const ctx = cargar();
  ctx.localStorage = localStorageLleno();
  let respaldos = 0;
  ctx.scheduleDriveBackup = () => { respaldos++; };

  assert.doesNotThrow(() => ctx.saveWithoutDrive());
  assert.equal(respaldos, 0, 'por su nombre no debe programar el respaldo de Drive');
  assert.match(ultimoAviso(ctx), /No se pudo guardar/i);
});

test('persistirLocal devuelve true cuando el guardado si ocurre', () => {
  const ctx = cargar();
  const KEY = 'moto_repuesto_sandy_finanzas_v1';
  assert.equal(ctx.localStorage.getItem(KEY), null);
  assert.equal(ctx.persistirLocal(), true);
  assert.notEqual(ctx.localStorage.getItem(KEY), null, 'debe escribir el estado serializado');
  assert.deepEqual(plain(JSON.parse(ctx.localStorage.getItem(KEY))).empresa.nombre,
    'Moto Repuesto Sandy');
});

test('reajustarSecuenciaPPR solo renumera una vez', () => {
  const ctx = cargar();
  const db = dbDe(ctx);
  db.seriales = {};
  db.pagosPrestamos = [
    { id: 'p1', codigo: 'PPR-00001', fecha: '2026-03-01', estado: 'Activo' },
    { id: 'p2', codigo: 'PPR-00002', fecha: '2026-01-01', estado: 'Activo' },
  ];

  assert.equal(ctx.reajustarSecuenciaPPR(), true, 'la primera pasada renumera por fecha');
  assert.equal(dbDe(ctx).pagosPrestamos.find((x) => x.id === 'p2').codigo, 'PPR-00001');
  assert.equal(dbDe(ctx).pagosPrestamos.find((x) => x.id === 'p1').codigo, 'PPR-00002');
  assert.equal(dbDe(ctx).seriales.PPR_reajustada, true);

  /* Registrar un comprobante con fecha anterior ya no debe reordenar los anteriores. */
  const antes = dbDe(ctx).pagosPrestamos.map((x) => x.codigo);
  dbDe(ctx).pagosPrestamos.push({ id: 'p0', codigo: 'PPR-00003', fecha: '2025-12-01', estado: 'Activo' });
  assert.equal(ctx.reajustarSecuenciaPPR(), false, 'la segunda pasada no hace nada');
  assert.deepEqual(
    dbDe(ctx).pagosPrestamos.filter((x) => x.id !== 'p0').map((x) => x.codigo),
    antes,
    'los comprobantes ya emitidos conservan su numero'
  );
});

test('el arranque no crea empleados de ejemplo', () => {
  const ctx = cargar();
  assert.deepEqual(plain(dbDe(ctx).empleados), [],
    'no debe sembrar datos personales de una persona real');
});

test('el HTML no contiene el nombre que estaba sembrado como ejemplo', () => {
  const ctx = cargar();
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/Antonio de Jes[uú]s/i.test(html), 'queda el nombre en el placeholder del formulario');
});