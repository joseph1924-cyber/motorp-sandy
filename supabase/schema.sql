-- ═══════════════════════════════════════════════════════════════════════════════
-- Moto Repuesto Sandy — esquema de Supabase
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Aplicar en el SQL Editor de Supabase (Dashboard → SQL → New query → Run), o con
--   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- Es idempotente: se puede volver a aplicar sin romper nada. NO borra la tabla, así
-- que aplicarlo dos veces no pierde tus datos.
--
-- ───────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UN SOLO DOCUMENTO Y NO UNA TABLA POR COLECCIÓN
-- ───────────────────────────────────────────────────────────────────────────────
-- Tu app ya trata todo el estado como un único documento: localStorage lo guarda
-- entero, IndexedDB lo clona entero, el JSON de respaldo es el documento completo y
-- la carpeta de Drive escribe el archivo completo. Reflejar eso en Postgres con 16
-- tablas obligaría a inventar un capa de mapeo que hoy no existe, con riesgo real de
-- corromper saldos. Una fila con jsonb mantiene esa forma y hace que cada guardado
-- sea una sola escritura atómica: nunca queda a medias.
--
-- El tamaño no es un problema: el estado vacío ocupa ~320 bytes y cada registro
-- operativo entre 150 y 275. El techo de la cuota lo marcará el logo en base64.
--
-- ───────────────────────────────────────────────────────────────────────────────
-- POR QUÉ `rev` Y NO SÓLO UNA FECHA
-- ───────────────────────────────────────────────────────────────────────────────
-- Como la app debe funcionar sin conexión, puede pasar esto: el portátil está
-- offline, registras un pago, y mientras tanto abres el móvil y registras otro. Al
-- recuperar la red, dos dispositivos quieren escribir. Sin `rev`, el que escriba
-- último gana en silencio y se pierde el pago del otro.
--
-- `rev` convierte esa pérdida de datos en un aviso. Cada escritura lleva el `rev` que
-- el cliente cree que tiene; si el servidor no coincide, el UPDATE no toca nada y la
-- app detiene la sincronización para que decidas. Para datos financieros preferimos
-- un falso positivo a perder un pago.
--
-- Las fechas NO sirven para esto: `actualizado_en` tiene precisión de microsegundos y
-- dos dispositivos pueden escribir dentro del mismo milisegundo.
-- ───────────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────────
-- Tabla
-- ───────────────────────────────────────────────────────────────────────────────
create table if not exists documentos (
  id             uuid        primary key default gen_random_uuid(),

  -- `default auth.uid()` es lo importante: el SERVIDOR decide a qué pertenece el
  -- documento, nunca el cliente. Así ni siquiera una app con la llave anon podría
  -- escribir en nombre de otro usuario, y la política de abajo pasa a ser una
  -- segunda barrera en vez de la única.
  user_id        uuid        not null default auth.uid() references auth.users(id) on delete cascade,

  -- El estado completo de la app. Un solo documento por usuario, garantizado abajo.
  data           jsonb       not null,

  -- Contador monótono. Solo lo incrementa la app, nunca Postgres: así el cliente
  -- puede afirmar "escribo la versión N" y saber si alguien escribió en medio.
  rev            integer     not null default 1 check (rev >= 1),

  actualizado_en timestamptz not null default now(),

  -- Un documento por usuario. La app asume que existe como máximo uno; si este
  -- índice desapareciera, `descargarDocumento()` empezaría a devolver varias filas y
  -- el arranque fallaría. Por eso el verificador de RLS lo comprueba.
  constraint documentos_unico_por_usuario unique (user_id)
);

-- `create table if not exists` no toca una tabla que ya existe: si alguien corrige
-- este archivo y lo reaplica sobre una tabla creada antes, el cambio de arriba NO se
-- aplicaría. Por eso el default se reaffirma aquí de forma explícita, que sí corre
-- siempre. Es idempotente.
alter table documentos alter column user_id set default auth.uid();

comment on table documentos is
  'Estado completo de Moto Repuesto Sandy. Un documento JSONB por usuario. Las escrituras son atómicas porque la app escribe siempre el estado entero en una sola operación.';
comment on column documentos.data is
  'Estado completo de la app, con las mismas claves que localStorage: empresa, security, seriales y las 14 colecciones operativas.';
comment on column documentos.rev is
  'Versión del documento. Solo la app la incrementa. Sirve para detectar ediciones concurrentes entre dispositivos sin conexión.';


-- ───────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ───────────────────────────────────────────────────────────────────────────────
-- La app no envía esta columna: se calcula aquí para que ningún cliente pueda
-- fecharlo mal o saltárselo.
create or replace function documentos_tocar() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists documentos_tocar on documentos;
create trigger documentos_tocar
  before update on documentos
  for each row execute function documentos_tocar();


-- ───────────────────────────────────────────────────────────────────────────────
-- Seguridad: RLS
-- ───────────────────────────────────────────────────────────────────────────────
-- LA LLAVE `anon` SE PUBLICARÁ DENTRO DEL HTML DE LA APP. Eso es normal en Supabase y
-- la llave NO es un secreto: es una etiqueta pública que identifica al rol `anon`.
-- Lo único que protege tu contabilidad es que las políticas de abajo sean correctas.
-- Si `alter table ... enable row level security` faltara, cualquiera que abriera la
-- URL leería y escribiría todos tus datos financieros.
--
-- Ejecuta `npm run supabase:verificar` antes de cargar datos reales. Comprueba con
-- peticiones reales que sin sesión no se ve nada y que la escritura condicionada por
-- `rev` funciona.

alter table documentos enable row level security;

-- Una sola política para las cuatro operaciones. En un INSERT solo se evalúa
-- `with check`, que es lo que impide crear documentos a nombre de otro usuario.
drop policy if exists "solo mi documento" on documentos;
create policy "solo mi documento" on documentos
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ───────────────────────────────────────────────────────────────────────────────
-- RLS no se puede comprobar desde el navegador; el script supabase/verificar-rls.js
-- lo hace con peticiones reales. Si necesitas confirmarlo a mano desde SQL Editor,
-- esto debe devolver 0 filas (la sesión del editor no pertenece a auth.users):
--
--   select count(*) from documentos;
--
-- Para comprobar el plan de consulta y confirmar que Postgres aplica el filtro y no
-- solo omite las filas:
--
--   explain select * from documentos;   -- debe filtrar por user_id