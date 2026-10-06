# Fase 1 — Proyecto Supabase y esquema

Todo lo de esta fase está fuera de la app: es el proyecto de Supabase, la tabla y las
políticas de seguridad. La app sigue funcionando igual hasta que empecemos la Fase 2.

**Orden: proyecto → SQL → usuario → `npm run supabase:verificar`.** No cargues datos
reales antes de que el verificador diga que todo está correcto.

---

## 1. Crear el proyecto

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta.
2. **New project**. Elige una contraseña de base de datos y anótala: no la necesitarás
   para este trabajo, pero es la única forma de recuperar el proyecto si pierdes el
   acceso.
3. Guarda dos datos de **Settings → API**:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon public** → empieza por `eyJ...`

> La llave `anon` va dentro del HTML de la app. **No es un secreto**: es una etiqueta
> pública que dice "soy un visitante". Lo único que protege tu contabilidad es que las
> políticas RLS estén correctas, y eso lo comprueba el paso 4.
>
> Nunca uses la llave **service_role** en la app ni en ningún archivo del repositorio.
> Esa salta RLS por completo. Si alguna vez la pegas en el código, cámbiala.

## 2. Aplicar el esquema

**Dashboard → SQL Editor → New query**, pega el contenido de [`schema.sql`](schema.sql) y
pulsa **Run**.

Crea una sola cosa:

| | |
|---|---|
| Tabla | `documentos` — una fila por usuario, con el estado completo en `data jsonb` |
| Seguridad | RLS activado, con una política que solo deja ver y escribir tu fila |
| Conflicto | Columna `rev`, para no pisar cambios hechos en otro dispositivo |

El archivo se puede volver a aplicar sin romper nada y **no borra la tabla**.

## 3. Crear tu usuario

**Dashboard → Authentication → Users → Add user**:

- Correo y contraseña: los que usarás para entrar a la app.
- Activa **Auto Confirm User**.

## 4. Verificar (obligatorio antes de seguir)

Crea `supabase/.env.local` — queda en `.gitignore`, así que no se sube al repositorio:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_EMAIL=tu@correo.com
SUPABASE_PASSWORD=tu-clave
```

Y ejecuta:

```
npm run supabase:verificar
```

El script **borra al final el documento de prueba que crea**, así que no deja basura.

## Qué comprueba

El script **borra al final el documento de prueba que crea**, así que no deja basura.

**Antes de tocar la red**

| Prueba | Qué demuestra si pasa |
|---|---|
| Las cuatro variables presentes | El archivo está bien escrito |
| La llave es de rol `anon` | Se decodifica el JWT y se lee su campo `role`. Una `service_role` se detecta y **aborta el script** |
| `.gitignore` cubre los `.env` | Las credenciales no se suben al repositorio |
| No hay llaves `service_role` en el repo | Se buscan secretos reales (`sb_secret_…`, JWT con `role: service_role`), no la palabra suelta, para no saltar con la documentación que la nombra |

**Sin sesión, como visitante con la URL**

| Prueba | Qué demuestra si pasa |
|---|---|
| `SELECT` devuelve 0 filas | Nadie lee tu contabilidad sin tu contraseña |
| `INSERT` bloqueado con 4xx | Nadie escribe datos falsos |
| `DELETE` no afecta ninguna fila | Nadie borra tu información |
| `UPDATE` no afecta ninguna fila | Nadie modifica tu información |
| Ninguna operación dejó datos | Los bloqueos ocurren antes de escribir, no después |

> `INSERT` da un error, pero `UPDATE` y `DELETE` no: RLS simplemente hace que la fila no
> sea visible, así que la operación afecta 0 filas y responde con éxito. Por eso las
> pruebas exigen "0 filas afectadas" y no un 403.

**Con tu sesión**

| Prueba | Qué demuestra si pasa |
|---|---|
| Sesión iniciada | Tu usuario existe y la contraseña es correcta |
| Limpieza previa | No quedan restos de pruebas anteriores |
| `INSERT` **sin** `user_id` → `rev=1` | El servidor rellena el propietario solo |
| El `user_id` asignado es el de tu sesión | El default es el correcto |
| `INSERT` con un `user_id` **ajeno** → rechazado | **No se puede escribir en el documento de otro** |
| `PATCH` con `rev` correcto → avanza | La actualización funciona |
| `PATCH` con `rev` obsoleto → 0 filas | **Dos dispositivos sin conexión no se pisan** |
| El documento conserva su valor tras el conflicto | No se pierden escrituras |

Si algo falla, el script dice qué hacer. Salida `0` = todo correcto.

## Por qué `user_id` tiene `default auth.uid()`

La columna es `user_id uuid not null default auth.uid()`. Ese default es lo que hace
seguro el conjunto: **el servidor decide a qué pertenece cada documento**, nunca el
cliente. La app nunca manda `user_id`, así que ni una app con la llave `anon` podría
escribir en tu nombre, y la política RLS pasa a ser una segunda barrera en vez de la
única.

Si insertas sin este default, la columna queda en `NULL`, la comparación
`auth.uid() = user_id` se resuelve a `NULL` y Postgres rechaza la fila con:

```
42501  new row violates row-level security policy for table "documentos"
```

Que es justo el error que aparecía antes de añadirlo.

---

## Sobre el tamaño de los datos

Un estado vacío ocupa ~320 bytes y cada registro operativo entre 150 y 275. El límite
práctico lo pone el **logo**: al guardarse dentro del documento como base64, cada
guardado arrastra el logo entero. Un logo de 184 KB suma 184 KB a cada escritura.

Para una app de un usuario funciona de sobra. Si algún día te molesta, se saca a una
tabla aparte; queda anotado como mejora, no se hace ahora.

## Estado

- [x] Esquema y políticas escritos en [`schema.sql`](schema.sql)
- [x] Verificador de RLS en [`verificar-rls.js`](verificar-rls.js)
- [x] `.gitignore` protege los `.env`
- [ ] **Proyecto creado** (tú)
- [ ] **SQL aplicado** (tú)
- [ ] **Usuario creado** (tú)
- [ ] **`npm run supabase:verificar` en verde** (tú, con las credenciales)

Siguiente fase: cliente REST, arranque y sincronización offline.