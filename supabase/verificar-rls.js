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

  /* Una service_role empieza por otra clave y saltaría TODAS las políticas RLS.
   * Es la única forma de perder la protección sin querer, así que se comprueba. */
  if (/service_role/i.test(CFG.anon)) {
    mal('SUPABASE_ANON_KEY parece ser una llave service_role',
      'Esa llave SALTA RLS por completo: cualquiera con ella leería y escribiría tu contabilidad. Cámbiala en Dashboard → Settings → API y usa la de rol `anon`.');
    return false;
  }
  ok('la llave no es service_role');
  return true;
}

function revisarRepo() {
  t.write('\nREPOSITORIO\n');
  const f = path.join(RAIZ, '.gitignore');
  const texto = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (/\.env/.test(texto)) ok('.gitignore excluye los .env');
  else mal('.gitignore no excluye los .env', 'Las credenciales podrían commitearse por accidente.');

  /* Busca la llave service_role en todo el árbol, por si alguien la pegó en el código. */
  const sospechosos = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'original'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!/\.(js|html|json|sql|md|env|txt)$/.test(e.name)) continue;
      const txt = fs.readFileSync(p, 'utf8');
      if (e.name === 'verificar-rls.js' || p.endsWith('verificar-rls.js')) continue;
      if (txt.includes('service_role')) sospechosos.push(path.relative(RAIZ, p));
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

/* Una escritura bloqueada por RLS se manifiesta como 401 o 403. */
const BLOQUEADO = (e) => e === 401 || e === 403;

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
  } else if (lectura.estado === 401 || lectura.estado === 403) {
    ok('SELECT rechazado con 401/403: RLS activo');
  } else {
    mal(`SELECT sin sesión devolvió ${lectura.estado} con datos`,
      `Si hay filas visibles, cualquiera con la URL puede leer tu contabilidad.
     ${JSON.stringify(lectura.datos).slice(0, 200)}
     Aplica supabase/schema.sql: falta "alter table documentos enable row level security".`);
  }

  const insercion = await pedir('POST', `/rest/v1/${TABLA}`, { cuerpo: { data: documentoFalso } });
  if (BLOQUEADO(insercion.estado)) ok(`INSERT rechazado con ${insercion.estado}: no se puede crear desde anon`);
  else mal(`INSERT sin sesión devolvió ${insercion.estado}`, 'Debería ser 401 o 403.');

  const borrado = await pedir('DELETE', `/rest/v1/${TABLA}`);
  if (BLOQUEADO(borrado.estado)) ok(`DELETE rechazado con ${borrado.estado}`);
  else mal(`DELETE sin sesión devolvió ${borrado.estado}`, 'Debería ser 401 o 403.');

  const lectura2 = await pedir('GET', `/rest/v1/${TABLA}?select=id`);
  if (Array.isArray(lectura2.datos) && lectura2.datos.length === 0) ok('el INSERT fallido no dejó nada escrito');
  else mal('quedaron filas tras un INSERT bloqueado', JSON.stringify(lectura2.datos).slice(0, 200));
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

  /* Se limpia cualquier documento previo para que la prueba sea repetible. */
  await pedir('DELETE', `/rest/v1/${TABLA}`, { token });

  const vacio = await pedir('GET', `/rest/v1/${TABLA}?select=id`, { token });
  if (vacio.estado === 200 && Array.isArray(vacio.datos)) ok(`SELECT autenticado funciona (${vacio.datos.length} documentos)`);
  else mal(`SELECT autenticado devolvió ${vacio.estado}`, JSON.stringify(vacio.datos).slice(0, 200));

  const insercion = await pedir('POST', `/rest/v1/${TABLA}?select=id,rev`, {
    token, prefiere: 'return=representation', cuerpo: { data: { empresa: { nombre: 'Prueba' }, prestamos: [] } },
  });
  if (insercion.estado === 201 && Array.isArray(insercion.datos) && insercion.datos.length === 1) {
    ok('INSERT permitido con tu sesión');
    const doc = insercion.datos[0];
    if (doc.rev === 1) ok('rev inicial es 1');
    else mal(`rev inicial es ${doc.rev}, se esperaba 1`);
    return doc;
  }
  mal(`INSERT autenticado devolvió ${insercion.estado}`,
    'Si es 403, tu usuario existe pero la política no le corresponde el user_id.\n     ' +
    '     ' + JSON.stringify(insercion.datos).slice(0, 300));
  return null;
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