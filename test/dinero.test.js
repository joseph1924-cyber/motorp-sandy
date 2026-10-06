/* Pruebas de la lógica de dinero. Sin dependencias: `npm test`.
 * Se ejecuta con node --test (Node 18+).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, ultimoAviso, dbDe, ponerDb } = require('./entorno.js');

/* Prestamo de 12,000 a 2% mensual, 12 cuotas, sin seguro.
 * Cuota francesa real: 12000*0.02/(1-1.02^-12) = 1134.72. */
const ORIGINAL = 12000;
const CUOTA = 1134.72;

/* Los objetos que vienen del contexto vm tienen otro Array/Object.prototype, asi que
 * deepEqual los rechaza aunque el contenido sea identico. Se normalizan al copiarlos. */
const plain = (v) => JSON.parse(JSON.stringify(v));

function prestamoBase(extra = {}) {
  /* Cada cuota lleva su parte de capital/interés para poder comprobar que el saldo
   * baja por capital y no por el total pagado. */
  let saldo = ORIGINAL;
  const cuotas = [];
  for (let i = 1; i <= 12; i++) {
    const interes = Math.round(saldo * 0.02 * 100) / 100;
    const capital = Math.round((CUOTA - interes) * 100) / 100;
    saldo = Math.round((saldo - capital) * 100) / 100;
    cuotas.push({
      numero: i,
      fecha: `2026-${String(i).padStart(2, '0')}-31`,
      monto: CUOTA,
      montoRestante: CUOTA,
      capital,
      interes,
      seguro: 0,
      estado: 'Pendiente',
    });
  }
  return {
    id: 'p1',
    codigo: 'PRE-0001',
    acreedorId: 'ac1',
    saldo: ORIGINAL,
    montoOriginal: ORIGINAL,
    cuota: CUOTA,
    totalCuotas: 12,
    cuotasPagadas: 0,
    proximaCuota: 1,
    proximoVencimiento: '2026-01-31',
    frecuencia: 'Mensual',
    cuotas,
    ...extra,
  };
}

function ctxConPrestamo(p) {
  const ctx = cargar();
  ponerDb(ctx, { ...dbDe(ctx), prestamos: [p] });
  return ctx;
}

test('applyLoanPayment salda cuotas en orden y reduce el saldo solo por capital', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const capitalEsperado = p.cuotas[0].capital + p.cuotas[1].capital;

  const r = ctx.applyLoanPayment(p, CUOTA * 2);

  assert.equal(r.applied, CUOTA * 2);
  assert.equal(r.capitalApplied, capitalEsperado,
    'el saldo baja por capital, no por el total pagado');
  assert.equal(p.saldo, Math.round((ORIGINAL - capitalEsperado) * 100) / 100);
  assert.equal(p.cuotas[0].estado, 'Pagada');
  assert.equal(p.cuotas[1].estado, 'Pagada');
  assert.equal(p.cuotas[2].estado, 'Pendiente');
  assert.equal(p.cuotasPagadas, 2);
  assert.equal(p.proximaCuota, 3);
});

test('applyLoanPayment con pago parcial no salda la cuota', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const r = ctx.applyLoanPayment(p, 500);

  assert.equal(r.applied, 500);
  assert.equal(p.cuotas[0].estado, 'Pendiente');
  assert.ok(Math.abs(p.cuotas[0].montoRestante - (CUOTA - 500)) < 0.01);
  assert.equal(p.cuotasPagadas, 0);
  assert.equal(p.proximaCuota, 1, 'sigue en la cuota 1');
});

test('applyLoanPayment ignora cuotas ya pagadas', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  ctx.applyLoanPayment(p, CUOTA);
  const saldoTrasPrimero = p.saldo;
  ctx.applyLoanPayment(p, CUOTA);

  assert.equal(p.cuotas[0].estado, 'Pagada');
  assert.equal(p.cuotas[1].estado, 'Pagada');
  assert.ok(p.saldo < saldoTrasPrimero);
});

test('reverseLoanPayment devuelve cuotas y saldo al estado previo', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const original = plain(p);

  const r = ctx.applyLoanPayment(p, CUOTA * 2);
  ctx.reverseLoanPayment(p, { aplicaciones: r.apps });

  assert.equal(p.saldo, original.saldo, 'el saldo vuelve al original');
  assert.equal(p.cuotasPagadas, 0);
  assert.equal(p.proximaCuota, 1);
  assert.equal(p.cuotas[0].estado, 'Pendiente');
  assert.equal(p.cuotas[0].montoRestante, original.cuotas[0].montoRestante);
  assert.equal(p.cuotas[1].montoRestante, original.cuotas[1].montoRestante);
});

test('pagar y revertir dos veces deja el préstamo idéntico al original', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const original = plain(p);

  for (let i = 0; i < 2; i++) {
    ctx.reverseLoanPayment(p, { aplicaciones: ctx.applyLoanPayment(p, 3000).apps });
  }

  assert.deepEqual(
    { saldo: p.saldo, cuotasPagadas: p.cuotasPagadas, proximaCuota: p.proximaCuota },
    { saldo: original.saldo, cuotasPagadas: original.cuotasPagadas, proximaCuota: original.proximaCuota }
  );
});

test('salvar la cuota final deja proximaCuota en totalCuotas y saldo en 0', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  ctx.applyLoanPayment(p, 999999);

  assert.equal(p.saldo, 0);
  assert.ok(p.cuotas.every((q) => q.estado === 'Pagada'));
  assert.equal(p.cuotasPagadas, 12);
  assert.equal(p.proximaCuota, 12);
});

test('un pago que excede una cuota se derrama sobre la siguiente, sin pasarse del total', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const r = ctx.applyLoanPayment(p, CUOTA + 500);

  assert.equal(r.applied, CUOTA + 500, 'cubre la cuota 1 y abona 500 de la 2');
  assert.equal(p.cuotas[0].estado, 'Pagada');
  assert.equal(p.cuotas[1].estado, 'Pendiente');
  assert.ok(Math.abs(p.cuotas[1].montoRestante - (CUOTA - 500)) < 0.01);
  assert.equal(p.cuotas[2].montoRestante, CUOTA, 'la cuota 3 queda intacta');
});

test('nunca se aplica mas capital que el saldo pendiente total', () => {
  const p = prestamoBase();
  const ctx = ctxConPrestamo(p);
  const r = ctx.applyLoanPayment(p, 999999);

  assert.ok(r.capitalApplied <= p.montoOriginal, 'el capital aplicado no supera el monto original');
  assert.ok(p.saldo >= 0, 'el saldo nunca queda negativo');
});

/* La tabla se genera leyendo los campos del formulario, asi que hay que poblarlos. */
function formAmortizacion(ctx, { original, tasaMensual, plazo, cuota = '' }) {
  const $ = (id) => ctx.document.getElementById(id);
  $('pr-original').value = String(original);
  $('pr-tasa-mensual').value = String(tasaMensual);
  $('pr-total-cuotas').value = String(plazo);
  $('pr-cuota').value = cuota;
  $('pr-frecuencia').value = 'Mensual';
  $('pr-vencimiento').value = '2026-01-31';
  ctx.generarTablaAmortizacionAutomatica();
  return $('pr-amort-body');
}

/* La tabla se arma con appendChild de <tr>, y cada celda es un <input>. */
function leerTabla(tb) {
  return tb.children.map((tr) => {
    const valor = (clase) => {
      const m = String(tr.innerHTML).match(new RegExp(`class="${clase}"[^>]*value="([^"]*)"`));
      return Number(String(m?.[1] ?? '').replace(/[^\d.-]/g, ''));
    };
    const fecha = String(tr.innerHTML).match(/class="pra-fecha"[^>]*value="([^"]*)"/);
    return {
      numero: valor('pra-num'),
      fecha: fecha?.[1] ?? '',
      capital: valor('pra-capital'),
      interes: valor('pra-interes'),
      seguro: valor('pra-seguro'),
      monto: valor('pra-cuota'),
      saldo: valor('pra-saldo'),
    };
  });
}

test('amortizacion francesa: 12000 a 2% en 12 cuotas da cuota ~1134.72', () => {
  const ctx = cargar();
  const tb = formAmortizacion(ctx, { original: 12000, tasaMensual: 2, plazo: 12 });
  const filas = leerTabla(tb);

  assert.equal(filas.length, 12);
  assert.ok(Math.abs(filas[0].monto - 1134.72) < 0.02, `cuota esperada ~1134.72, obtenida ${filas[0].monto}`);
  assert.ok(Math.abs(filas[0].interes - 240) < 0.01, 'el primer interes es 2% de 12000');
  assert.ok(Math.abs(filas[0].capital - 894.72) < 0.02, 'el capital de la primera cuota es cuota - interes');
});

test('la tabla amortizada agota el capital en exactamente el plazo', () => {
  const ctx = cargar();
  const tb = formAmortizacion(ctx, { original: 12000, tasaMensual: 2, plazo: 12 });
  const filas = leerTabla(tb);
  const capitalTotal = filas.reduce((s, r) => s + r.capital, 0);

  assert.equal(filas.length, 12);
  assert.ok(Math.abs(capitalTotal - 12000) < 0.05, `el capital debe sumar 12000, sumo ${capitalTotal}`);
});

test('el interes de cada cuota se calcula sobre el saldo restante', () => {
  const ctx = cargar();
  const tb = formAmortizacion(ctx, { original: 12000, tasaMensual: 2, plazo: 12 });
  const filas = leerTabla(tb);
  let saldo = 12000;

  for (const f of filas) {
    assert.ok(Math.abs(f.interes - Math.round(saldo * 0.02 * 100) / 100) < 0.011,
      `interes de la cuota ${f.numero} no corresponde al saldo ${saldo}`);
    saldo = Math.round((saldo - f.capital) * 100) / 100;
  }
});

test('una cuota fija insuficiente se rechaza en vez de generar una tabla incompleta', () => {
  const ctx = cargar();
  const tb = formAmortizacion(ctx, { original: 12000, tasaMensual: 2, plazo: 12, cuota: '300.00' });

  assert.equal(leerTabla(tb).length, 0, 'no debe escribir una tabla que no amortiza');
  assert.match(ultimoAviso(ctx), /no permiten amortizar/i,
    `se esperaba aviso de cuota insuficiente, se obtuvo: ${ultimoAviso(ctx)}`);
});

test('a tasa cero el capital se reparte en partes iguales', () => {
  const ctx = cargar();
  const tb = formAmortizacion(ctx, { original: 12000, tasaMensual: 0, plazo: 12 });
  const filas = leerTabla(tb);

  assert.equal(filas.length, 12);
  filas.forEach((f) => assert.equal(f.interes, 0));
  assert.ok(Math.abs(filas.reduce((s, r) => s + r.capital, 0) - 12000) < 0.05);
});

/* --- Pagos a proveedor --- */

function ctxConFacturas(facturas) {
  const ctx = cargar();
  ponerDb(ctx, { ...dbDe(ctx), facturasSuplidor: facturas });
  return ctx;
}

test('applySupplierPayment aplica de la factura mas antigua a la mas reciente', () => {
  const ctx = ctxConFacturas([
    { id: 'f2', suplidorId: 's1', saldo: 500, vencimiento: '2026-03-01' },
    { id: 'f1', suplidorId: 's1', saldo: 300, vencimiento: '2026-01-01' },
    { id: 'f3', suplidorId: 's2', saldo: 900, vencimiento: '2026-01-01' },
  ]);
  const r = ctx.applySupplierPayment('s1', 600);
  const fac = dbDe(ctx).facturasSuplidor;

  assert.equal(r.applied, 600);
  assert.deepEqual(plain(r.apps.map((a) => a.facturaId)), ['f1', 'f2'], 'ordena por vencimiento');
  assert.equal(fac.find((f) => f.id === 'f1').saldo, 0);
  assert.equal(fac.find((f) => f.id === 'f2').saldo, 200);
  assert.equal(fac.find((f) => f.id === 'f3').saldo, 900, 'no toca otro suplidor');
});

test('applySupplierPayment aplica solo lo que alcanza y reverse lo devuelve', () => {
  const ctx = ctxConFacturas([{ id: 'f1', suplidorId: 's1', saldo: 300, vencimiento: '2026-01-01' }]);
  const pago = { aplicaciones: ctx.applySupplierPayment('s1', 1000).apps };

  assert.equal(pago.aplicaciones[0].aplicado, 300, 'solo aplica el saldo disponible');
  assert.equal(dbDe(ctx).facturasSuplidor[0].saldo, 0);

  ctx.reverseSupplierPayment(pago);
  assert.equal(dbDe(ctx).facturasSuplidor[0].saldo, 300, 'la devolucion restituye el saldo');
});

test('pago y devolucion de proveedor dejan las facturas intactas', () => {
  const ctx = ctxConFacturas([
    { id: 'f1', suplidorId: 's1', saldo: 300, vencimiento: '2026-01-01' },
    { id: 'f2', suplidorId: 's1', saldo: 450.5, vencimiento: '2026-02-01' },
  ]);
  const original = plain(dbDe(ctx).facturasSuplidor);
  ctx.reverseSupplierPayment({ aplicaciones: ctx.applySupplierPayment('s1', 500).apps });

  assert.deepEqual(plain(dbDe(ctx).facturasSuplidor), original);
});

test('las facturas ya saldadas no reciben aplicacion', () => {
  const ctx = ctxConFacturas([
    { id: 'f1', suplidorId: 's1', saldo: 0, vencimiento: '2026-01-01' },
    { id: 'f2', suplidorId: 's1', saldo: 400, vencimiento: '2026-02-01' },
  ]);
  const r = ctx.applySupplierPayment('s1', 250);

  assert.deepEqual(plain(r.apps.map((a) => a.facturaId)), ['f2']);
  assert.equal(dbDe(ctx).facturasSuplidor[0].saldo, 0);
});
