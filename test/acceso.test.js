/* Pruebas de la pantalla de acceso.
 *
 * Antes esto era una ventana de 380px encima de la app, con la app dibujada detrás. Ahora
 * es una pantalla completa que oculta la app. Eso cambia dos cosas que hay que vigilar:
 * que la app quede de verdad inaccesible mientras el login está abierto (si no, se puede
 * tabular hasta la contabilidad sin haber entrado), y que "Continuar sin conexión" siga
 * siendo una salida válida, porque trabajar sin red es un modo normal y no un error.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cargar, MODULOS, RAIZ, dbDe } = require('./entorno.js');

/* Sin main.js: aquí se prueba el flujo del login, no el arranque completo. */
const MODULOS_SIN_ARRANQUE = MODULOS.filter((m) => m !== 'js/main.js');

const USUARIO = { id: 'usuario-1', email: 'prueba@ejemplo.test' };

function token(dentroDeSegundos) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + dentroDeSegundos })}.firma`;
}

/** Responde como un Supabase mínimo: sesión, documento vacío y creación de documento. */
function servidor({ credencialesValidas = true } = {}) {
  const llamadas = [];
  const responder = (estado, cuerpo) => ({
    ok: estado < 400,
    status: estado,
    text: async () => JSON.stringify(cuerpo ?? ''),
    json: async () => cuerpo,
  });
  const fetch = async (url, opciones = {}) => {
    llamadas.push({ url, metodo: opciones.method || 'GET' });
    if (url.includes('/auth/v1/token')) {
      if (!credencialesValidas) {
        return responder(400, { error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      }
      return responder(200, { access_token: token(3600), refresh_token: 'refresh-1', user: USUARIO });
    }
    if ((opciones.method || 'GET') === 'GET') return responder(200, []);
    if (opciones.method === 'POST') return responder(201, [{ id: 'doc-1', rev: 1 }]);
    if (opciones.method === 'PATCH') return responder(200, [{ id: 'doc-1', rev: 2 }]);
    return responder(204, null);
  };
  return { fetch, llamadas };
}

const asentar = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

function montar(serv, extra = {}) {
  const ctx = cargar(MODULOS_SIN_ARRANQUE, {
    fetch: serv.fetch,
    navigator: { userAgent: 'node', onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    ...extra,
  });
  return { ctx, app: ctx.document.getElementById('app') };
}

const abierta = (ctx) => ctx.document.getElementById('acceso').classList.contains('abierta');
const appOculta = (ctx) => ctx.document.body.classList.contains('acceso-activo');
const error = (ctx) => ctx.document.getElementById('acceso-error').textContent;

test('sin sesión, abrir la app muestra la pantalla de acceso y esconde la app', async () => {
  const { ctx } = montar(servidor());
  await asentar();

  await ctx.accesoNube();
  await asentar();

  assert.equal(abierta(ctx), true, 'debe mostrarse la pantalla de acceso');
  assert.equal(appOculta(ctx), true, 'la app debe quedar oculta mientras no se entra');
  /* Esta es la razón de ocultar la app y no solo taparla: detrás ya no se puede llegar
   * con el teclado ni con un lector de pantalla. */
  assert.equal(ctx.document.body.classList.contains('acceso-activo'), true);
});

test('entrar bien oculta la pantalla y conecta con la nube', async () => {
  const serv = servidor();
  const { ctx } = montar(serv);

  ctx.document.getElementById('acceso-correo').value = 'prueba@ejemplo.test';
  ctx.document.getElementById('acceso-clave').value = 'clave-de-prueba';

  await ctx.accesoEnviar();
  await asentar();

  assert.equal(abierta(ctx), false, 'la pantalla de acceso debe desaparecer');
  assert.equal(appOculta(ctx), false, 'la app debe volver a verse');
  assert.ok(ctx.sbLeerSesion(), 'debe quedar la sesión guardada en este dispositivo');
  assert.ok(serv.llamadas.some((c) => c.url.includes('grant_type=password')), 'debe intentar entrar');
});

test('una contraseña incorrecta explica el problema y no deja pasar a la app', async () => {
  const { ctx } = montar(servidor({ credencialesValidas: false }));
  await ctx.accesoNube();
  await asentar();

  ctx.document.getElementById('acceso-correo').value = 'prueba@ejemplo.test';
  ctx.document.getElementById('acceso-clave').value = 'equivocada';

  await ctx.accesoEnviar();
  await asentar();

  assert.match(error(ctx), /incorrectos/i, 'debe decir que el correo o la contraseña no cuadran');
  assert.equal(appOculta(ctx), true, 'no debe dejar entrar en la app con una contraseña mala');
  assert.equal(ctx.sbLeerSesion(), null, 'no debe guardar ninguna sesión');
});

test('sin conexión, el aviso no culpa a la contraseña', async () => {
  const { ctx } = montar(servidor());
  await ctx.accesoNube();
  await asentar();
  /* Un fallo de red tiene que decirse como fallo de red: pedirle a alguien que revise
   * su contraseña cuando lo que pasa es que no hay internet le hace perder el tiempo. */
  ctx.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  ctx.document.getElementById('acceso-correo').value = 'prueba@ejemplo.test';
  ctx.document.getElementById('acceso-clave').value = 'la-que-sea';

  await ctx.accesoEnviar();
  await asentar();

  assert.match(error(ctx), /sin conexión/i);
  assert.doesNotMatch(error(ctx), /incorrectos/i);
});

test('enviar sin escribir nada avisa de qué falta', async () => {
  const { ctx } = montar(servidor());
  await ctx.accesoNube();
  await asentar();

  await ctx.accesoEnviar();
  await asentar();

  assert.match(error(ctx), /correo y contraseña/i);
  assert.equal(appOculta(ctx), true, 'debe seguir pidiendo el acceso');
});

test('continuar sin conexión abre la app con los datos de este equipo', async () => {
  const serv = servidor();
  const { ctx } = montar(serv);
  await ctx.accesoNube();
  await asentar();
  serv.llamadas.length = 0;

  ctx.accesoSinConexion();
  await asentar();

  assert.equal(abierta(ctx), false, 'debe entrar a la app');
  assert.equal(appOculta(ctx), false, 'la app debe verse');
  assert.equal(serv.llamadas.length, 0, 'no debe intentar hablar con la nube');
  assert.ok(dbDe(ctx).empresa, 'debe conservar los datos locales');
});

test('el botón de ver contraseña alterna el campo y lo anuncia', () => {
  const { ctx } = montar(servidor());
  const campo = ctx.document.getElementById('acceso-clave');
  campo.type = 'password';

  ctx.accesoVerClave();
  const boton = ctx.document.querySelector('.acceso-ver');
  assert.equal(campo.type, 'text', 'debe mostrar la contraseña');
  assert.equal(boton.getAttribute('aria-pressed'), 'true', 'debe anunciarse como activado');
  assert.equal(boton.getAttribute('aria-label'), 'Ocultar contraseña');
  assert.equal(boton.textContent, 'Ocultar');

  ctx.accesoVerClave();
  assert.equal(campo.type, 'password', 'debe volver a ocultarla');
  assert.equal(boton.getAttribute('aria-pressed'), 'false');
  assert.equal(boton.getAttribute('aria-label'), 'Mostrar contraseña');
});

test('al ocultar la pantalla, la contraseña no se queda a la vista', async () => {
  const { ctx } = montar(servidor());
  const campo = ctx.document.getElementById('acceso-clave');
  campo.type = 'password';

  ctx.accesoVerClave();
  ctx.accesoOcultar();

  assert.equal(campo.type, 'password', 'no debe quedar escrita a la vista al salir');
});

test('cerrar sesión vuelve a la pantalla de acceso sin borrar los datos', async () => {
  const { ctx } = montar(servidor());
  await ctx.accesoNube();
  await asentar();
  ctx.document.getElementById('acceso-correo').value = 'prueba@ejemplo.test';
  ctx.document.getElementById('acceso-clave').value = 'clave';
  await ctx.accesoEnviar();
  await asentar();

  ctx.accesoSalir();
  await asentar();

  assert.equal(abierta(ctx), true, 'debe volver a pedir el acceso');
  assert.equal(appOculta(ctx), true, 'la app debe quedar oculta otra vez');
  assert.equal(ctx.sbLeerSesion(), null, 'debe cerrar la sesión en este equipo');
  /* Cerrar sesión es lo que dice que es: salir de este equipo. Ni los datos locales ni los
   * de la nube se tocan. */
  assert.ok(dbDe(ctx).empresa, 'los datos locales deben seguir intactos');
});

test('index.html tiene la pantalla de acceso con los elementos que el JS busca', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

  for (const id of ['acceso', 'acceso-correo', 'acceso-clave', 'acceso-error']) {
    assert.ok(html.includes(`id="${id}"`), `falta id="${id}" en la pantalla de acceso`);
  }
  assert.ok(html.includes('class="acceso-ver"'), 'falta el botón de ver contraseña');
  assert.ok(html.includes('role="alert"'), 'el error debe anunciarse a lectores de pantalla');
  /* El JS busca estos ids por nombre: si uno cambia, el arnés de pruebas lo seguiría
   * creando al vuelo y nadie se enteraría hasta abrir la app. */
  assert.ok(!html.includes('capa-acceso'), 'ya no debe quedar nada del nombre anterior');
  const entrada = /onclick="accesoVerClave\(\)"/.test(html);
  assert.ok(entrada, 'el botón de ver contraseña debe estar enlazado a accesoVerClave()');
});