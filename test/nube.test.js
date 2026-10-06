/* Pruebas del motor de sincronización con Supabase.
 *
 * Lo que se prueba aquí no es que Supabase funcione — eso lo comprueba
 * `npm run supabase:verificar` contra el proyecto real — sino las decisiones de la app que
 * de verdad se rompen: qué se sube, cuándo, qué pasa cuando no hay red, y sobre todo que
 * una edición de otro dispositivo NO se sobrescribe en silencio.
 *
 * El servidor de Supabase se simula con un `fetch` falso que guarda un solo documento y
 * respeta el `rev`, igual que hace la base de datos: un PATCH con el rev equivocado no
 * cambia nada y devuelve cero filas. Esa imitación es la que hace Significantly
 * significativo el test de conflicto.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, MODULOS, dbDe, ponerDb, leer } = require('./entorno.js');

/* Se carga todo menos el arranque: aquí interesa单机 el motor, no la interfaz. */
const MODULOS_SIN_ARRANQUE = MODULOS.filter((m) => m !== 'js/main.js' && m !== 'js/ui/nube-acceso.js');

const USUARIO = { id: 'usuario-1', email: 'prueba@ejemplo.test' };

/** Token con forma de JWT: al cliente solo le importa el `exp` del payload. */
function token(dentroDeSegundos) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + dentroDeSegundos;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp, role: 'authenticated' })}.firma`;
}

function sesion(dentroDeSegundos = 3600) {
  return {
    access_token: token(dentroDeSegundos),
    refresh_token: 'refresh-1',
    user: USUARIO,
    expires_in: dentroDeSegundos,
  };
}

/** Servidor mínimo de Supabase: una tabla de un documento por usuario y control de rev. */
function servidor({ documento = null, red = true } = {}) {
  const llamadas = [];
  let doc = documento;
  const responder = (estado, cuerpo) => ({
    ok: estado < 400,
    status: estado,
    text: async () => (cuerpo === null ? '' : JSON.stringify(cuerpo)),
    json: async () => cuerpo,
  });

  const fetch = async (url, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    llamadas.push({ url, metodo, cuerpo });

    if (!red) throw new TypeError('Failed to fetch');

    if (url.includes('/auth/v1/token')) return responder(200, sesion());

    if (metodo === 'GET') {
      return responder(200, doc ? [{ id: doc.id, rev: doc.rev, data: doc.data }] : []);
    }
    if (metodo === 'POST') {
      doc = { id: 'doc-creado', rev: cuerpo.rev, data: cuerpo.data };
      return responder(201, [{ id: doc.id, rev: doc.rev }]);
    }
    if (metodo === 'PATCH') {
      /* PostgREST devuelve 200 con un arreglo vacío cuando el filtro no casa nada: no es
       * un error, es el aviso de que otro dispositivo escribió antes. */
      const revPedido = /rev=eq\.(\d+)/.exec(url);
      if (!doc || !revPedido || doc.rev !== Number(revPedido[1])) return responder(200, []);
      doc = { ...doc, rev: cuerpo.rev, data: cuerpo.data };
      return responder(200, [{ id: doc.id, rev: doc.rev }]);
    }
    if (metodo === 'DELETE') {
      doc = null;
      return responder(204, null);
    }
    return responder(404, { message: 'ruta no simulada' });
  };

  return {
    fetch,
    llamadas,
    documento: () => doc,
    peticiones: (metodo) => llamadas.filter((c) => c.metodo === metodo && !c.url.includes('/auth/v1/')),
    ponerRed: (valor) => { red = valor; },
  };
}

/** Espera a que se apilen las promesas pendientes del contexto. */
const asentar = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

/**
 * Monta el contexto con el `fetch` del servidor y un `setTimeout` que NO ejecuta los
 * temporizadores: se guardan y se disparan a mano, que es la única forma de comprobar
 * que la subida está agrupada de verdad y no sale en cada pulsación.
 */
function montar(serv, extra = {}) {
  const pendientes = new Map();
  let secuencia = 0;
  const ctx = cargar(MODULOS_SIN_ARRANQUE, {
    fetch: serv.fetch,
    navigator: { userAgent: 'node', onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    /* clearTimeout tiene que cancelar de verdad: es justamente lo que agrupa las subidas
     * en una sola. Con un clearTimeout que no hace nada, el motor "subiría" tres veces y
     * la prueba pasaría sin comprobar nada. */
    setTimeout: (fn) => { pendientes.set(++secuencia, fn); return secuencia; },
    clearTimeout: (id) => { pendientes.delete(id); },
    ...extra,
  });
  return {
    ctx,
    /* Cuántas subidas hay agendadas ahora mismo: el agrupado se ve en que esto es 1. */
    agendados: () => pendientes.size,
    disparar: async () => {
      for (const [id, fn] of [...pendientes]) {
        pendientes.delete(id);
        fn();
      }
      await asentar();
    },
  };
}

const estado = (ctx) => leer(ctx, 'nubeEstado');
const LIMPIO = (ctx) => leer(ctx, 'NUBE_LIMPIO');
const CONFLICTO = (ctx) => leer(ctx, 'NUBE_CONFLICTO');
const SIN_CONEXION = (ctx) => leer(ctx, 'NUBE_SIN');

test('sin sesión no se habla con la nube ni se sube nada', async () => {
  const serv = servidor();
  const { ctx, disparar } = montar(serv);
  await asentar();

  ponerDb(ctx, { ...dbDe(ctx), gastos: [{ id: 'g-1' }] });
  ctx.save();
  await asentar();

  assert.equal(serv.llamadas.length, 0, 'no debe haber peticiones sin sesión');
  assert.equal(estado(ctx), leer(ctx, 'NUBE_PENDIENTE'), 'el cambio debe quedar pendiente');
  assert.equal(ctx.sbLeerMeta().sucio, true, 'debe quedar registrado aunque no se pueda subir');

  /* Cuando por fin se intenta subir, se avisa de que no hay sesión en vez de fallar. */
  await disparar();
  assert.equal(estado(ctx), SIN_CONEXION(ctx), 'debe quedar en "sin conexión"');
  assert.equal(serv.llamadas.length, 0, 'sigue sin haber ninguna petición');
  assert.equal(dbDe(ctx).gastos[0].id, 'g-1', 'el cambio no se pierde: sigue en local');
});

test('el token caducado se renueva solo y la sesión queda actualizada', async () => {
  const serv = servidor();
  const { ctx } = montar(serv);

  ctx.sbGuardarSesion(sesion(-10));
  const nuevo = await ctx.sbToken();

  const renovaciones = serv.llamadas.filter((c) => c.url.includes('grant_type=refresh_token'));
  assert.equal(renovaciones.length, 1, 'debe renovar el token caducado');
  assert.ok(nuevo && nuevo.startsWith('ey'), 'debe devolver el token nuevo');
  assert.equal(ctx.sbLeerSesion().refresh_token, 'refresh-1', 'la sesión debe quedar guardada');
});

test('un 401 en una lectura se reintenta una vez con el token renovado', async () => {
  let primera = true;
  const serv = servidor({ documento: { id: 'doc-1', rev: 4, data: { gastos: [] } } });
  const original = serv.fetch;
  const fetchCon401 = async (url, opciones) => {
    if (String(url).includes('/rest/v1/') && primera) {
      primera = false;
      return { ok: false, status: 401, text: async () => JSON.stringify({ code: 'PGRST301', message: 'JWT expirado' }) };
    }
    return original(url, opciones);
  };
  const { ctx } = montar(serv, { fetch: fetchCon401 });
  ctx.sbGuardarSesion(sesion(3600));

  const documento = await ctx.sbLeerDocumento();

  assert.equal(documento.rev, 4, 'debe leer el documento tras reintentar');
  assert.ok(serv.llamadas.some((c) => c.url.includes('grant_type=refresh_token')),
    'debe renovar el token antes del segundo intento');
});

test('proyecto nuevo: al conectar se crea el documento con los datos de este dispositivo', async () => {
  const serv = servidor();
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave-de-prueba');

  await ctx.nubeConectar();
  await asentar();

  const creados = serv.peticiones('POST');
  assert.equal(creados.length, 1, 'debe crear el documento');
  assert.equal(creados[0].cuerpo.rev, 1, 'un documento nuevo empieza en rev 1');
  assert.equal(creados[0].cuerpo.data.empresa.nombre, 'Moto Repuesto Sandy');
  assert.equal(estado(ctx), LIMPIO(ctx), 'debe quedar sincronizado');
  assert.equal(leer(ctx, 'nubeId'), 'doc-creado', 'debe recordar el id del documento');
});

test('sin nada pendiente, la nube manda y su versión se adopta', async () => {
  const serv = servidor({
    documento: { id: 'doc-1', rev: 3, data: { gastos: [{ id: 'g-1', concepto: 'desde la nube' }] } },
  });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');

  await ctx.nubeConectar();
  await asentar();

  assert.equal(dbDe(ctx).gastos[0].concepto, 'desde la nube', 'debe adoptar los datos remotos');
  assert.equal(leer(ctx, 'nubeRev'), 3, 'debe adoptar el rev remoto');
  assert.equal(ctx.sbLeerMeta().sucio, false, 'no debe quedar nada pendiente');
  assert.equal(serv.peticiones('PATCH').length, 0, 'no hay nada que subir');
});

test('un cambio pendiente con rev desfasado da conflicto y NO sobrescribe la nube', async () => {
  const serv = servidor({
    documento: { id: 'doc-1', rev: 5, data: { gastos: [{ id: 'g-remoto' }] } },
  });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  /* Simula una escritura local que se quedó sin subir, con un rev que ya no es el de la nube. */
  ctx.sbGuardarMeta({ id: 'doc-1', rev: 2, sucio: true });

  await ctx.nubeConectar();
  await asentar();

  assert.equal(estado(ctx), CONFLICTO(ctx), 'debe detenerse y pedir decisión');
  assert.equal(serv.peticiones('PATCH').length, 0, 'no debe intentar escribir bajo un rev ajeno');
  assert.deepEqual(serv.documento().data, { gastos: [{ id: 'g-remoto' }] },
    'el documento de la nube debe quedar intacto');
});

test('los cambios se agrupan: nada sube hasta que pasa el tiempo', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 1, data: { gastos: [] } } });
  const { ctx, disparar, agendados } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  await ctx.nubeConectar();
  await asentar();
  serv.llamadas.length = 0;

  ponerDb(ctx, { ...dbDe(ctx), gastos: [{ id: 'g-1' }] });
  ctx.save();
  ctx.save();
  ctx.save();
  await asentar();

  assert.equal(serv.peticiones('PATCH').length, 0, 'tres cambios seguidos no deben ser tres subidas');
  assert.equal(agendados(), 1, 'los tres cambios deben compartir un único temporizador');

  await disparar();

  const parches = serv.peticiones('PATCH');
  assert.equal(parches.length, 1, 'debe salir una sola subida agrupada');
  assert.equal(parches[0].cuerpo.rev, 2, 'debe avanzar el rev en uno');
  assert.equal(parches[0].cuerpo.data.gastos[0].id, 'g-1', 'debe enviar el último contenido');
});

test('si otro dispositivo escribió antes, la subida se detiene sin pisar nada', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 2, data: { gastos: [{ id: 'g-remoto' }] } } });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  /* Dispositivo con un rev viejo y un cambio local que no ha salido. */
  leer(ctx, 'nubeId="doc-1";nubeRev=1;nubeSucio=true;');

  await ctx.nubeSubir();
  await asentar();

  assert.equal(estado(ctx), CONFLICTO(ctx), 'debe pedir decisión en vez de sobrescribir');
  assert.equal(serv.documento().rev, 2, 'el rev remoto no debe avanzar');
  assert.deepEqual(serv.documento().data.gastos, [{ id: 'g-remoto' }],
    'los datos remotos deben seguir intactos');
});

test('resolver el conflicto con "la nube" deja los metadatos coherentes', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 7, data: { gastos: [{ id: 'g-nube' }] } } });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  leer(ctx, 'nubeId="doc-1";nubeRev=6;nubeSucio=true;nubeConflicto={id:"doc-1",rev:7,data:{gastos:[{id:"g-nube"}]}};');

  await ctx.nubeResolver('nube');
  await asentar();

  assert.equal(dbDe(ctx).gastos[0].id, 'g-nube', 'debe quedar la versión de la nube');
  const meta = ctx.sbLeerMeta();
  assert.equal(meta.sucio, false, 'no debe quedar nada pendiente tras resolver');
  assert.equal(meta.rev, 6, 'el rev local debe seguir al que se acaba de adoptar');

  /* Regresión: con el metadato viejo, al volver a conectar la app anunciaba un conflicto
   * que ya estaba resuelto y volcaba la pantalla de aviso sin motivo. */
  leer(ctx, 'nubeConflicto=null;');
  await ctx.nubeConectar();
  await asentar();
  assert.notEqual(estado(ctx), CONFLICTO(ctx), 'reconectar no debe inventar otro conflicto');
});

test('resolver el conflicto con "este dispositivo" reescribe sobre el rev remoto', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 7, data: { gastos: [{ id: 'g-nube' }] } } });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  ponerDb(ctx, { ...dbDe(ctx), gastos: [{ id: 'g-mio' }] });
  leer(ctx, 'nubeId="doc-1";nubeRev=6;nubeSucio=true;nubeConflicto={id:"doc-1",rev:7,data:{gastos:[{id:"g-nube"}]}};');

  await ctx.nubeResolver('local');
  await asentar();

  const parche = serv.peticiones('PATCH')[0];
  assert.match(parche.url, /rev=eq\.7/, 'debe escribir sobre el rev que hay ahora en la nube');
  assert.equal(serv.documento().rev, 8, 'el rev debe avanzar');
  assert.deepEqual(serv.documento().data.gastos, [{ id: 'g-mio' }], 'debe quedar la versión local');
});

test('sin red el cambio se guarda aquí y sube solo al volver la conexión', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 1, data: { gastos: [] } } });
  const { ctx, disparar } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  /* Se sincroniza de verdad y luego se cae la red: editar sin conexión es el caso normal,
   * no una excepción. */
  await ctx.nubeConectar();
  await asentar();
  assert.equal(estado(ctx), LIMPIO(ctx), 'parte de estar al día');
  serv.ponerRed(false);

  ponerDb(ctx, { ...dbDe(ctx), gastos: [{ id: 'g-offline' }] });
  ctx.save();
  await disparar();

  assert.equal(estado(ctx), SIN_CONEXION(ctx), 'debe seguir esperando');
  assert.equal(ctx.sbLeerMeta().sucio, true, 'el cambio debe quedar pendiente registrado');

  /* Se limpia el registro para contar solo el reintento: el PATCH anterior falló con la red
   * caída y ese intento ya está comprobado arriba. */
  serv.llamadas.length = 0;
  serv.ponerRed(true);
  ctx.dispatchEvent({ type: 'online' });
  await asentar();

  assert.equal(serv.peticiones('PATCH').length, 1, 'al volver la red debe subir lo pendiente');
  assert.deepEqual(serv.documento().data.gastos, [{ id: 'g-offline' }], 'debe subir el cambio');
  assert.equal(estado(ctx), LIMPIO(ctx), 'debe quedar sincronizado');
});

test('restablecer datos borra el documento de la nube y crea uno nuevo vacío', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 9, data: { gastos: [{ id: 'g-1' }] } } });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  await ctx.nubeConectar();
  await asentar();

  ponerDb(ctx, { ...dbDe(ctx), gastos: [] });
  const ok = await ctx.nubeRestablecer();
  await asentar();

  assert.equal(ok, true, 'debe completar el borrado');
  assert.equal(serv.peticiones('DELETE').length, 1, 'debe borrar el documento viejo');
  assert.equal(serv.peticiones('POST').length, 1, 'debe crear el nuevo');
  assert.equal(serv.documento().rev, 1, 'el documento nuevo empieza en rev 1');
  assert.deepEqual(serv.documento().data.gastos, [], 'debe quedar vacío');
});

test('restaurar una copia local fuerza la subida aunque hubiera un conflicto', async () => {
  const serv = servidor({ documento: { id: 'doc-1', rev: 4, data: { gastos: [] } } });
  const { ctx } = montar(serv);
  await ctx.sbIniciarSesion('prueba@ejemplo.test', 'clave');
  leer(ctx, 'nubeId="doc-1";nubeRev=4;nubeSucio=false;nubeConflicto={id:"doc-1",rev:4,data:{gastos:[]}};');
  ponerDb(ctx, { ...dbDe(ctx), gastos: [{ id: 'g-restaurado' }] });

  await ctx.nubeSubirRestauracion();
  await asentar();

  assert.equal(serv.peticiones('PATCH').length, 1, 'la copia restaurada debe subir');
  assert.deepEqual(serv.documento().data.gastos, [{ id: 'g-restaurado' }],
    'si no subiera, la nube la pisaría al siguiente arranque');
  assert.equal(estado(ctx), LIMPIO(ctx), 'debe quedar sincronizado');
});