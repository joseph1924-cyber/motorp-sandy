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

| Prueba | Qué demuestra si pasa |
|---|---|
| `SELECT` sin sesión devuelve 0 filas | Nadie puede leer tu contabilidad sin tu contraseña |
| `INSERT` sin sesión → 401/403 | Nadie puede escribir datos falsos |
| `DELETE` sin sesión → 401/403 | Nadie puede borrar tu información |
| El `INSERT` fallido no dejó filas | El bloqueo ocurrió antes de escribir |
| Sesión iniciada | Tu usuario existe y la contraseña es correcta |
| `INSERT` con sesión → `rev=1` | Tu usuario sí puede escribir su documento |
| `PATCH` con `rev` correcto → avanza | La actualización funciona |
| `PATCH` con `rev` obsoleto → 0 filas | **Dos dispositivos sin conexión no se pisan** |
| El documento conserva su valor tras el conflicto | No se pierden escrituras |
| `.gitignore` cubre los `.env` | Las credenciales no se suben al repositorio |
| No hay `service_role` en el repo | La llave que salta RLS no está filtrada |

Si algo falla, el script dice qué hacer. Salida `0` = todo correcto.

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