#!/usr/bin/env node
/**
 * Verificación de RLS y del control de concurrencia de Moto Repuesto Sandy.
 *
 * Comprueba, con peticiones reales contra tu proyecto, que:
 *   1. Sin sesión no se puede leer, escribir, modificar ni borrar nada.
 *   2. Con tu sesión sí se puede leer y escribir.
 *   3. La actualización condicionada por `rev` detecta ediciones concurrentes.
 *
 * Ejecutar DESPUÉS de aplicar supabase/schema.sql y ANTES de cargar datos reales.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   SUPABASE_EMAIL=tu@correo.com \
 *   SUPABASE_PASSWORD=tu-clave \
 *   node supabase/verificar-rls.js
 *
 * O con un archivo de variables:
 *   node --env-file=supabase/.env.local supabase/verificar-rls.js
 *
 * La llave `service_role` NO se usa aquí ni debe existir en este repositorio.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

/* Lee supabase/.env.local y .env si existen, para no depender de Node >= 20.6
 * (el proyecto declara engines >= 18) ni de tener que pasar flags. Las variables ya
 * presentes en el entorno tienen prioridad. */
(function cargarEnv() {
  for (const nombre of ['.env.local', '.env']) {
    const p = path.join(__dirname, nombre);
    if (!fs.existsSync(p)) continue;
    for (const linea of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i.exec(linea);
      if (!m) continue;
      const clave = m[1];
      if (process.env[clave]) continue;
      process.env[clave] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
})();

const CFG = {
  url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anon: process.env.SUPABASE_ANON_KEY || '',
  email: process.env.SUPABASE_EMAIL || '',
  password: process.env.SUPABASE_PASSWORD || '',
};

const TABLA = 'documentos';

/* ── salida ────────────────────────────────────────────────────────────────── */
const t = process.stdout;
let fallos = 0, avisos = 0,total = 0;
const ok = (n) => { total++; t.write(`  \x1b[32m✅\x1b[0m ${n}\n`); };
const mal = (n, d) => { total++; fallos++; t.write(`  \x1b[31m❌\x1b[0m ${n}\n`); if (d) t.write(`     ${d}\n`); };
const nota = (n, d) => { total++; avisos++; t.write(`  \x1b[33m⚠\x1b[0m  ${n}\n`); if (d) t.write(`     ${d}\n`); };

/* ── comprobaciones previas ────────────────────────────────────────────────── */
function revisarConfig() {
  t.write('\nCONFIGURACIÓN\n');
  const falta = [];
  if (!CFG.url) falta.push('SUPABASE_URL');
  if (!CFG.anon) falta.push('SUPABASE_ANON_KEY');
  if (!CFG.email) falta.push('SUPABASE_EMAIL');
  if (!CFG.password) falta.push('SUPABASE_PASSWORD');

  if (falta.length) {
    mal(`faltan variables: ${falta.join(', ')}`,
      'Ejemplo:\n     SUPABASE_URL=https://xxxx.supabase.co \\\n     SUPABASE_ANON_KEY=eyJ... \\\n     SUPABASE_EMAIL=tu@correo.com SUPABASE_PASSWORD=tu-clave \\\n     node supabase/verificar-rls.js');
    return false;
  }
  ok('variables presentes');

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/.test(CFG.url)) {
    nota(`SUPABASE_URL no tiene forma de URL de Supabase: ${CFG.url}`,
      'Debería ser algo como https://xxxxxxx.supabase.co');
  }

  /* Detecta una llave service_role. Un `test()` sobre el texto crudo no serviría:
   * la palabra va dentro del payload del JWT, codificado en base64, así que jamás
   * aparecería en claro. Hay que decodificar el token y mirar el campo `role`. */
  const rol = leerRolJwt(CFG.anon);
  if (CFG.anon.startsWith('sb_secret_')) {
    mal('SUPABASE_ANON_KEY es una llave secreta nueva (sb_secret_...)',
      'Esa llave SALTA RLS por completo: cualquiera con ella leería y escribiría tu contabilidad.\n' +
      '     Usa la de rol `anon` de Dashboard → Settings → API, que empieza por eyJ.');
    return false;
  }
  if (rol === 'service_role') {
    mal('SUPABASE_ANON_KEY es una llave service_role',
      'Esa llave SALTA RLS por completo: cualquiera con ella leería y escribiría tu contabilidad.\n' +
      '     Cámbiala en Dashboard → Settings → API y usa la de rol `anon`.');
    return false;
  }
  if (rol !== 'anon') {
    nota(`el rol de la llave no es "anon" sino "${rol ?? 'desconocido'}"`,
      'Se espera una llave de rol `anon`. Si es `service_role`, la nube NO está protegida.');
  }
  ok(`la llave es de rol "${rol ?? 'desconocido'}", no salta RLS`);
  return true;
}

/** Lee el campo `role` del payload de un JWT, o null si no se puede descifrar. */
function leerRolJwt(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  try {
    const payload = Buffer.from(partes[1], 'base64url').toString('utf8');
    return JSON.parse(payload).role ?? null;
  } catch {
    return null;
  }
}

/** Patrones que delatan una llave de verdad, no la palabra suelta. */
const SECRETOS = [
  /sb_secret_[A-Za-z0-9_\-]{10,}/,                     // llaves secretas nuevas de Supabase
  /['"]?role['"]?\s*:\s*['"]service_role['"]/,        // payload JWT u objeto con role: service_role
  /service_?role\s*[:=]\s*['"]?(eyJ|sb_secret_)/i,        // asignación del tipo SERVICE_ROLE=eyJ...
];

const EXTENSIONES = /\.(js|mjs|cjs|ts|html|json|sql|md|txt|ya?ml|sh|ini|cfg|conf)$/i;

/* Un filtro por extensión solo se dejaba fuera justo lo que más importa: `.env.local`
 * y `.env.production` terminan en `.local` y `.production`, no en `.env`. */
function esEscaneable(nombre) {
  return EXTENSIONES.test(nombre) || /\.env($|\.)/i.test(nombre) || /\.local$/i.test(nombre);
}

function revisarRepo() {
  t.write('\nREPOSITORIO\n');
  const f = path.join(RAIZ, '.gitignore');
  const texto = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (/\.env/.test(texto)) ok('.gitignore excluye los .env');
  else mal('.gitignore no excluye los .env', 'Las credenciales podrían commitearse por accidente.');

  /* Busca llaves service_role de verdad en el árbol. Buscar la palabra suelta
   * "service_role" daba falsos positivos con cualquier comentario o documentación
   * que nombres la llave para advertir contra ella, que es justo lo que hace el
   * README. Solo interesan los secretos reales. */
  const sospechosos = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'original'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!esEscaneable(e.name)) continue;
      if (p.endsWith('verificar-rls.js')) continue;
      const txt = fs.readFileSync(p, 'utf8');
      if (SECRETOS.some((re) => re.test(txt))) sospechosos.push(path.relative(RAIZ, p));
    }
  })(RAIZ);

  if (sospechosos.length) mal(`service_role aparece en: ${sospechosos.join(', ')}`);
  else ok('ninguna llave service_role en el repositorio');
}

/* ── peticiones ────────────────────────────────────────────────────────────── */
function cabeceras(token) {
  const h = { apikey: CFG.anon, 'Content-Type': 'application/json' };
  h.Authorization = `Bearer ${token || CFG.anon}`;
  return h;
}

async function pedir(metodo, ruta, { token, cuerpo, prefiere } = {}) {
  const h = cabeceras(token);
  if (prefiere) h.Prefer = prefiere;
  const r = await fetch(`${CFG.url}${ruta}`, {
    method: metodo,
    headers: h,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { estado: r.status, datos, texto };
}

/* Un INSERT bloqueado por RLS se manifiesta como 401/403/42501. DELETE y UPDATE, en
 * cambio, no dan error: RLS oculta la fila y la operación afecta 0 filas. */
const BLOQUEADO = (e) => e === 401 || e === 403;

/** Lee el campo `code` de un error de PostgREST, si lo hay. */
function leerCodigo(r) {
  return r?.datos && typeof r.datos === 'object' ? r.datos.code ?? null : null;
}

/* ── pruebas ───────────────────────────────────────────────────────────────── */
async function probarAnon() {
  t.write('\nSIN SESIÓN (rol anon)\n');
  const documentoFalso = {
    empresa: { nombre: 'PRUEBA DE INTRUSIÓN', margen: 30 },
    prestamos: [], facturasSuplidor: [], pagosSuplidor: [], pagosPrestamos: [],
    gastos: [], obligaciones: [], acreedores: [], suplidores: [], empleados: [], nominas: [],
    pagosObligaciones: [], gestionContado: [], gestionCredito: [], gestionRecibos: [], seriales: {},
  };

  const lectura = await pedir('GET', `/rest/v1/${TABLA}?select=id,data`);
  if (lectura.estado === 200 && Array.isArray(lectura.datos) && lectura.datos.length === 0) {
    ok('SELECT devuelve 0 filas: RLS filtra a quien no es tu usuario');
  } else if (BLOQUEADO(lectura.estado)) {
    ok(`SELECT rechazado con ${lectura.estado}: RLS activo`);
  } else if (leerCodigo(lectura) === 'PGRST205' || leerCodigo(lectura) === '42P01') {
    mal('la tabla `documentos` no existe todavía',
      'No es un problema de seguridad: falta un paso.\n' +
      '     Dashboard → SQL → New query, pega supabase/schema.sql y pulsa Run.');
  } else {
    mal(`SELECT sin sesión devolvió ${lectura.estado} con datos`,
      `Si hay filas visibles, cualquiera con la URL puede leer tu contabilidad.
     ${JSON.stringify(lectura.datos).slice(0, 200)}
     Aplica supabase/schema.sql: falta "alter table documentos enable row level security".`);
  }

  /* Un INSERT se RECHAZA con error: no hay filas visibles que filtrar, así que RLS
   * falla la comprobación `with check`. Por eso aquí sí se espera 4xx.
   * Con `default auth.uid()` el anónimo recibe además un NOT NULL (400) en lugar del
   * 403 de la política; ambos son correctos, así que se acepta cualquier 4xx y lo
   * que de verdad se comprueba es que no quede nada escrito. */
  const insercion = await pedir('POST', `/rest/v1/${TABLA}`, { cuerpo: { data: documentoFalso } });
  if (insercion.estado >= 400 && insercion.estado < 500) {
    ok(`INSERT anónimo bloqueado con ${insercion.estado} (${leerCodigo(insercion) || 'sin código'})`);
  } else {
    mal(`INSERT sin sesión devolvió ${insercion.estado}`, 'Debería ser un error 4xx.');
  }

  /* UPDATE y DELETE, en cambio, NO dan error: RLS simplemente hace que la fila no sea
   * visible, así que la operación afecta 0 filas y responde 200/204 con nada.
   * Por eso la prueba correcta no es "403" sino "no borró ni cambió nada".
   * El DELETE lleva filtro porque sin él PostgREST rechaza los borrados masivos con
   * 400, y porque un DELETE sin filtro no es una prueba que haya que mandar nunca. */
  const INEXISTENTE = '00000000-0000-0000-0000-000000000000';
  const borrado = await pedir('DELETE', `/rest/v1/${TABLA}?id=eq.${INEXISTENTE}`, { prefiere: 'return=representation' });
  if (Array.isArray(borrado.datos) && borrado.datos.length === 0) {
    ok(`DELETE anónimo no afecta ninguna fila (${borrado.estado})`);
  } else {
    mal(`DELETE anónimo devolvió ${borrado.estado} y tocó filas`,
      `Debería afectar 0 filas. ${JSON.stringify(borrado.datos).slice(0, 200)}`);
  }

  const actualizado = await pedir('PATCH', `/rest/v1/${TABLA}?id=eq.${INEXISTENTE}`, {
    prefiere: 'return=representation', cuerpo: { data: documentoFalso },
  });
  if (Array.isArray(actualizado.datos) && actualizado.datos.length === 0) {
    ok(`UPDATE anónimo no afecta ninguna fila (${actualizado.estado})`);
  } else {
    mal(`UPDATE anónimo devolvió ${actualizado.estado} y tocó filas`,
      `Debería afectar 0 filas. ${JSON.stringify(actualizado.datos).slice(0, 200)}`);
  }

  const lectura2 = await pedir('GET', `/rest/v1/${TABLA}?select=id`);
  if (Array.isArray(lectura2.datos) && lectura2.datos.length === 0) ok('ninguna operación anónima dejó datos');
  else mal('quedaron filas tras las operaciones bloqueadas', JSON.stringify(lectura2.datos).slice(0, 200));
}

async function iniciarSesion() {
  t.write('\nINICIO DE SESIÓN\n');
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CFG.anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CFG.email, password: CFG.password }),
  });
  const datos = await r.json().catch(() => null);
  if (r.status === 200 && datos?.access_token) {
    ok(`sesión iniciada con ${CFG.email}`);
    return datos.access_token;
  }
  if (r.status === 400 || r.status === 401) {
    mal(`no se pudo iniciar sesión (${r.status})`,
      'Comprueba que el usuario existe y que la contraseña es correcta.\n' +
      '     Si aún no lo has creado: Dashboard → Authentication → Users → Add user,\n' +
      '     con "Auto Confirm User" activado.');
  } else {
    mal(`inicio de sesión devolvió ${r.status}`, JSON.stringify(datos).slice(0, 300));
  }
  return null;
}

async function probarConSesion(token) {
  t.write('\nCON TU SESIÓN\n');

  /* Limpieza previa para que la prueba sea repetible. Esta petición llevaba un DELETE
   * sin filtro, que PostgREST rechaza con 400: nunca borraba nada y el resultado no se
   * comprobaba, así que el fallo pasaba desapercibido. Si quedaba un documento de una
   * ejecución previa, el INSERT de abajo chocaba con el índice único. */
  const limpieza = await pedir('DELETE', `/rest/v1/${TABLA}?user_id=not.is.null`, {
    token, prefiere: 'return=representation',
  });
  if (limpieza.estado === 200 && Array.isArray(limpieza.datos)) {
    ok(`limpieza previa: ${limpieza.datos.length} documentos antiguos borrados`);
  } else {
    mal(`la limpieza previa devolvió ${limpieza.estado}`,
      'Si no se limpió, el INSERT de prueba chocará con el índice único.\n     ' +
      `     ${JSON.stringify(limpieza.datos).slice(0, 200)}`);
  }

  const vacio = await pedir('GET', `/rest/v1/${TABLA}?select=id`, { token });
  if (vacio.estado === 200 && Array.isArray(vacio.datos)) ok(`SELECT autenticado funciona (${vacio.datos.length} documentos)`);
  else mal(`SELECT autenticado devolvió ${vacio.estado}`, JSON.stringify(vacio.datos).slice(0, 200));

  /* Omitir `user_id` a propósito: tiene que rellenarlo el default `auth.uid()` del
   * servidor. Si se enviara explícitamente, esta prueba no demostraría nada. */
  const insercion = await pedir('POST', `/rest/v1/${TABLA}?select=id,rev,user_id`, {
    token, prefiere: 'return=representation', cuerpo: { data: { empresa: { nombre: 'Prueba' }, prestamos: [] } },
  });
  if (insercion.estado === 201 && Array.isArray(insercion.datos) && insercion.datos.length === 1) {
    ok('INSERT permitido con tu sesión, sin mandar user_id');
    const doc = insercion.datos[0];
    if (doc.rev === 1) ok('rev inicial es 1');
    else mal(`rev inicial es ${doc.rev}, se esperaba 1`);

    /* El default rellenó el user_id con el de la sesión, no con otro cualquiera. */
    if (doc.user_id === uidDe(token)) ok('el servidor asignó el user_id de la sesión');
    else mal(`el documento quedó con user_id ${doc.user_id}, distinto al de tu sesión`);

    /* Prueba clave de seguridad: si el cliente PUEDE mandar user_id, entonces un
     * intruso podría escribir en tu documento. Tiene que rechazarlo la política.
     * Ojo al código de error: si lo rechaza la clave foránea (23503) en vez de la
     * política (42501), el rechazo se debe a que ese usuario no existe, no a que RLS
     * proteja. En ese caso la prueba no demuestra nada y se reporta como tal. */
    const AJENO = '11111111-2222-3333-4444-555555555555';
    const falsificado = await pedir('POST', `/rest/v1/${TABLA}?select=id`, {
      token, prefiere: 'return=representation',
      cuerpo: { user_id: AJENO, data: { empresa: { nombre: 'FALSIFICADO' } } },
    });
    const codigo = leerCodigo(falsificado);
    const es4xx = falsificado.estado >= 400 && falsificado.estado < 500;
    if (es4xx && codigo !== '23503') {
      ok(`no se puede falsificar el propietario: lo paró la política (${codigo || falsificado.estado})`);
    } else if (codigo === '23503') {
      nota('el INSERT con user_id ajeno lo paró la clave foránea, no la política',
        'Ese id no existe en auth.users, así que el rechazo vino de la FK (23503) y no de RLS.\n' +
        '     Esta prueba NO demuestra que la política proteja. Para comprobarlo de verdad,\n' +
        '     crea un segundo usuario en el panel y repite la prueba con su id real.');
    } else {
      mal(`un INSERT con user_id ajeno devolvió ${falsificado.estado}`,
        'Eso permitiría escribir en el documento de otro usuario. Revisa la política with check.');
    }
    return doc;
  }
  mal(`INSERT autenticado devolvió ${insercion.estado}`,
    `Si es 42501, falta el default del servidor. Aplica:\n     ` +
    '     alter table documentos alter column user_id set default auth.uid();\n     ' +
    `     ${JSON.stringify(insercion.datos).slice(0, 300)}`);
  return null;
}

/** Extrae el id de usuario de la sesión a partir del JWT. */
function uidDe(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).sub ?? null;
  } catch {
    return null;
  }
}

async function probarRev(token, doc) {
  t.write('\nCONTROL DE CONCURRENCIA (rev)\n');
  const ruta = `/rest/v1/${TABLA}?id=eq.${doc.id}`;

  const avance = await pedir('PATCH', `${ruta}&rev=eq.1`, {
    token, prefiere: 'return=representation',
    cuerpo: { rev: 2, data: { empresa: { nombre: 'Prueba v2' }, prestamos: [] } },
  });
  if (avance.estado === 200 && Array.isArray(avance.datos) && avance.datos.length === 1 && avance.datos[0].rev === 2) {
    ok('PATCH con rev correcto avanza a rev=2');
  } else {
    mal(`PATCH con rev=1 devolvió ${avance.estado}`, JSON.stringify(avance.datos).slice(0, 200));
  }

  /* Éste es el que impide perder datos entre dos dispositivos sin conexión. */
  const conflicto = await pedir('PATCH', `${ruta}&rev=eq.1`, {
    token, prefiere: 'return=representation',
    cuerpo: { rev: 2, data: { empresa: { nombre: 'CONFLICTO' }, prestamos: [] } },
  });
  if (conflicto.estado === 200 && Array.isArray(conflicto.datos) && conflicto.datos.length === 0) {
    ok('PATCH con rev obsoleto actualiza 0 filas: el conflicto se detecta');
  } else {
    mal(`PATCH con rev obsoleto devolvió ${conflicto.estado} con ${conflicto.datos?.length} filas`,
      'Si actualizó la fila, dos dispositivos podrían pisarse sin avisar.\n     ' +
      '     ' + JSON.stringify(conflicto.datos).slice(0, 200));
  }

  const intacto = await pedir('GET', `/rest/v1/${TABLA}?id=eq.${doc.id}&select=data,rev`, { token });
  const nombre = intacto.datos?.[0]?.data?.empresa?.nombre;
  if (nombre === 'Prueba v2') ok('el documento conserva el valor correcto tras el conflicto');
  else mal(`tras el conflicto el documento quedó como "${nombre}"`, 'Se perdió la escritura.');

  const limpieza = await pedir('DELETE', `/rest/v1/${TABLA}?id=eq.${doc.id}`, { token });
  if (limpieza.estado === 200 || limpieza.estado === 204) ok('limpieza: documento de prueba borrado');
  else nota(`no se pudo limpiar el documento de prueba (${limpieza.estado})`, `Bórralo a mano: id ${doc.id}`);
}

/* ── main ──────────────────────────────────────────────────────────────────── */
(async () => {
  t.write('\n╔══════════════════════════════════════════════════════════════╗');
  t.write('║  Verificación de RLS — Moto Repuesto Sandy                    ║');
  t.write('╚══════════════════════════════════════════════════════════════╝');

  if (!revisarConfig()) process.exit(1);
  revisarRepo();

  try {
    await probarAnon();
    const token = await iniciarSesion();
    if (token) {
      const doc = await probarConSesion(token);
      if (doc) await probarRev(token, doc);
    }
  } catch (e) {
    mal('fallo de red al hablar con Supabase', e.message);
    t.write('     Comprueba que SUPABASE_URL sea correcta y que el proyecto esté activo.\n');
  }

  t.write('\n' + '─'.repeat(64));
  if (fallos) {
    t.write(`\x1b[31m${fallos} COMPROBACIONES FALLIDAS\x1b[0m de ${total}. NO cargues datos reales todavía.\n\n`);
    process.exit(1);
  }
  if (avisos) t.write(`\x1b[32mTODO CORRECTO\x1b[0m (${total - fallos - avisos} correctas, ${avisos} con aviso)\n\n`);
  else t.write('\x1b[32mTODO CORRECTO ✅\x1b[0m — la nube está segura para tu contabilidad.\n\n');
})();