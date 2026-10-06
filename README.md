# Moto Repuesto Sandy

Aplicación de gestión financiera y operacional para el taller. No tiene dependencias,
framework ni paso de compilación: es HTML, CSS y JavaScript plano.

El repositorio tiene dos formas de usar el software, ambas equivalentes:

| Forma | Archivo | Cuándo usarla |
|---|---|---|
| **Desarrollo** | `index.html` + `css/` + `js/` | Editar el código, con separación por responsabilidades |
| **Distribución** | `dist/moto-repuesto-sandy.html` | Compartir, imprimir, mandar por correo o copiar a otra máquina |

Ambas abren directamente con doble clic desde el disco (`file://`). No hay servidor web.

## Comandos

```bash
npm test                # pruebas automáticas (49)
npm run verificar       # compara el código separado contra el monolito original
npm run build           # genera dist/moto-repuesto-sandy.html
npm run check           # test + verificar + build
npm run supabase:verificar   # comprueba RLS y control de concurrencia contra el proyecto real
npm run supabase:config      # regenera js/nucleo/config-supabase.js desde supabase/.env.local
```

`npm run build` no necesita instalar nada: es un script de Node sin dependencias.
`node build.js --verificar` es la red de seguridad importante —ver más abajo—.

## Estructura

```
index.html                     shell: <link> a las hojas y <script> a los módulos
build.js                       generador del archivo único + verificador de integridad
css/
  base.css                     variables, reset, tipografía, layout, panel lateral
  componentes.css              botones, campos, tablas, modales, badges, badges de estado
  vistas.css                   estilos propios de cada vista
  impresion.css                reglas @media print y documentos imprimibles
js/
  nucleo/                      infraestructura transversal
    utiles.js                  selectores, fechas, moneda, escapado, avisos
    almacen.js                 esquema de datos, carga, guardado, migraciones
    idb.js                     IndexedDB y migración desde localStorage
    respaldo.js                exportar / importar / restaurar respaldos
    respaldo-almacen.js        respaldo de Diskette, Google Drive, instalación PWA
    secuencias.js              numeración de comprobantes GO, PPR y CQP
    supabase.js                sesión y acceso a la API por REST (sin SDK)
    nube.js                    motor de sincronización: subida, conflictos y estados
    config-supabase.js         URL, anon key y tabla (generado; no editar a mano)
  dominio/                     reglas de negocio
    ventas.js                  ventas de contado y crédito
    gastos.js                  gastos
    nomina.js                  empleados y cálculo de nómina quincenal
    cxp.js                     cuentas por pagar
    cxp-reportes.js            reportes y exportación de CxP
    acreedores.js              acreedores
    obligaciones.js            obligaciones recurrentes
    prestamos.js               préstamos al personal
    pagos-prestamo.js          cronograma y pagos de préstamos
    cronograma.js              cuotas, intereses y morosidad
    empresa.js                 datos de la empresa
    resultados.js              estados de resultados
  ui/
    navegacion.js              cambio de vistas, submenú CxP, atajos
    editor.js                  modal de edición de registros
    impresion.js               impresión de comprobantes, recibos y reportes
    nube-acceso.js             pantalla de entrada y cierre de sesión
  main.js                      arranque: monta la interfaz y luego conecta con la nube
original/                      monolito v18 v5 intacto, usado como referencia
original/cambios-faseN.js      manifiesto de cambios posteriores, uno por fase
supabase/                      esquema, políticas RLS y verificador del proyecto real
  schema.sql                   tabla documento, rev, trigger y RLS
  verificar-rls.js             pruebas de seguridad y concurrencia
  generar-config.js            escribe js/nucleo/config-supabase.js
test/                          pruebas automáticas con node:test
dist/                          archivo único generado
```

## Por qué JavaScript clásico y no módulos ES

La aplicación se abre con `file://`. Los módulos ES (`type="module"`) están sujetos a
CORS y un navegador bloquea `import` desde el protocolo de archivo, así que se usan
scripts clásicos. El orden de los `<script>` en `index.html` es significativo: cada
módulo depende de lo que los anteriores definen.

## Verificación de integridad

El refactor partió de un monolito de 1.362 líneas. Para garantizar que la separación no
cambió nada, `build.js --verificar` compara el código actual contra `original/` y falla
si algo no cuadra:

- **CSS**: mismo número de reglas, ninguna perdida, ninguna inventada, y orden relativo
  preservado dentro de cada archivo.
- **JavaScript**: comparación por multiconjunto de líneas, así que detecta cualquier línea
  perdida, alterada o duplicada. Además compara todas las declaraciones y funciones de
  nivel superior.
- **HTML**: el `<body>` debe quedar intacto y el script de arranque debe ser el último.
- **Manifiestos**: cada cambio posterior al monolito está declarado en
  `original/cambios-faseN.js` con su archivo y su motivo. Si falta una declaración, o una
  línea cambia sin quedar registrada, la verificación falla.

La única diferencia esperada entre el monolito y el código es una llave `}`: la IIFE
`recoverLoanDataFromIndexedDB`, que estaba anidada dentro de `restoreBackupFile`, se
extrajo a `js/nucleo/idb.js` como función declarada para poder colocarla en su propio
módulo.

## Defecto del v18 v5 que sí se corrigió

`refresh()` llamaba a `fillCxpTerceros()`, una función que **no existía**: solo estaba la
llamada, nunca la definición, así que la vista de cuentas por pagar se quedaba a medio
dibujar. Es un defecto del original, no del refactor, y se corrigió definiéndola en
`js/dominio/cxp.js` y dejándola registrada en el manifiesto.

## Datos y sincronización

Hay dos capas, y la nube es la que manda:

- **Supabase** es la fuente de verdad. Cada usuario tiene un único documento JSONB en la
  tabla `documentos`, protegido por RLS para que solo su sesión pueda leerlo o escribirlo.
- **`localStorage`** es la caché de trabajo: la app dibuja siempre desde aquí, así que
  cargar, editar e imprimir funciona igual sin conexión.

Al entrar, la app compara lo que hay en la nube con lo que hay en el dispositivo. Si el
documento remoto ha cambiado desde la última vez que este equipo sincronizó, aparece un
**conflicto** y se pregunta cuál versión gana; nunca se sobrescribe una en silencio. Un
cambio guardado sin conexión se sube solo, agrupado 1,5 s después, y también en cuanto
vuelve la red.

Los respaldos siguen siendo independientes de esto: exportar genera un archivo que se puede
guardar donde sea, y Drive es la carpeta local de Drive for Desktop, no una API.

Claves en el navegador:

- `localStorage` → `moto_repuesto_sandy_finanzas_v1` (datos), `..._data_test_v1` (pruebas)
- IndexedDB → `moto_repuesto_sandy_drive_v1` (copias de seguridad)

## Configurar la nube

1. Crear el proyecto en Supabase y ejecutar `supabase/schema.sql` en el editor SQL.
2. Poner la URL, la anon key y la contraseña de la cuenta de servicio en
   `supabase/.env.local` (está en `.gitignore`; no se sube).
3. `npm run supabase:verificar` para comprobar que las políticas bloquean lo que deben.
4. `npm run supabase:config` para generar `js/nucleo/config-supabase.js`.

La anon key es pública por diseño: la seguridad la ponen las políticas RLS, que el
verificador comprueba. La contraseña de la cuenta de servicio solo la usan las pruebas y
no debe estar nunca en el código de la aplicación.
