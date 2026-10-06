#!/usr/bin/env node
/**
 * Genera js/nucleo/config-supabase.js a partir de supabase/.env.local.
 *
 * ¿Por qué no escribir la URL y la llave a mano en el código? Porque una cifra mal
 * pegada produce un error de autenticación que no dice nada obvio, y porque la fuente
 * de verdad ya está en el .env.local que rellenaste una vez.
 *
 * La URL y la llave `anon` SÍ se escriben en el archivo y se pueden subir al
 * repositorio: es el diseño normal de Supabase, la llave anon es pública. Lo que nunca
 * debe aparecer es `service_role`, y por eso aquí se rechaza antes de escribir nada.
 *
 *   npm run supabase:config
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(__dirname, '.env.local');
const DESTINO = path.join(RAIZ, 'js', 'nucleo', 'config-supabase.js');

/** Lee el mismo formato de .env.local que el verificador de RLS. */
function leerEnv() {
  const salida = {};
  if (!fs.existsSync(ORIGEN)) return salida;
  for (const linea of fs.readFileSync(ORIGEN, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i.exec(linea);
    if (!m) continue;
    salida[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return salida;
}

/** Mismo descifrado que usa el verificador, para no repetir el criterio. */
function leerRolJwt(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

const env = leerEnv();
const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
const llave = env.SUPABASE_ANON_KEY || '';
const problemas = [];

if (!url) problemas.push('SUPABASE_URL está vacío en supabase/.env.local');
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) problemas.push(`SUPABASE_URL no parece una URL de Supabase: ${url}`);

if (!llave) problemas.push('SUPABASE_ANON_KEY está vacío en supabase/.env.local');
else if (llave.startsWith('sb_secret_')) problemas.push('SUPABASE_ANON_KEY es una llave secreta (sb_secret_...). Usa la de rol anon.');
else if (leerRolJwt(llave) === 'service_role') problemas.push('SUPABASE_ANON_KEY es una service_role: salta RLS. Usa la de rol anon.');

if (problemas.length) {
  console.error('\n  No se generó el archivo de configuración:\n');
  for (const p of problemas) console.error(`    • ${p}`);
  console.error('\n  Revisa supabase/.env.local y vuelve a intentarlo.\n');
  process.exit(1);
}

const contenido = `/* Configuración de Supabase — GENERADO, NO EDITAR A MANO.
 *
 * Se crea con \`npm run supabase:config\` a partir de supabase/.env.local.
 *
 * La URL y la llave anon son públicas por diseño en Supabase: por eso pueden vivir
 * aquí y en el HTML de la app. No es un error que este archivo se suba al repositorio.
 * Lo que nunca debe aparecer es la llave service_role.
 */
const SUPABASE_URL='${url}';
const SUPABASE_ANON_KEY='${llave}';
const SUPABASE_TABLA='documentos';
`;

fs.writeFileSync(DESTINO, contenido);
console.log(`\n  Generado js/nucleo/config-supabase.js`);
console.log(`    URL   ${url}`);
console.log(`    Llave rol "${leerRolJwt(llave)}" (${llave.length} caracteres)`);
console.log(`    Tabla documentos\n`);