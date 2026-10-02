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
npm run verificar   # compara el código separado contra el monolito original
npm run build       # genera dist/moto-repuesto-sandy.html
npm run check       # verificar + build
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
  main.js                      arranque: carga datos y monta la interfaz
original/                      monolito v18 v5 intacto, usado como referencia
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
  perdida, alterada o duplicada. Además compara las 203 declaraciones y las 183 funciones
  de nivel superior.
- **HTML**: el `<body>` debe quedar intacto y el script de arranque debe ser el último.

La única diferencia esperada es una llave `}`: la IIFE `recoverLoanDataFromIndexedDB`, que
estaba anidada dentro de `restoreBackupFile`, se extrajo a `js/nucleo/idb.js` como función
declarada para poder colocarla en su propio módulo. La llamada se dejó sin `await`, igual
que en el original.

## Bug preexistente conocido

`refresh()` llama a `fillCxpTerceros()`, una función que **no existe** en el código: solo
aparece esa llamada, nunca su definición. Es un defecto del v18 v5, no del refactor, y se
reproduce igual en el archivo original. Se deja tal cual para no alterar el comportamiento
de la aplicación.

## Datos

La información se guarda en el navegador:

- `localStorage` → `moto_repuesto_sandy_finanzas_v1` (datos), `..._data_test_v1` (pruebas)
- IndexedDB → `moto_repuesto_sandy_drive_v1` (copias de seguridad)

No hay servidor ni sincronización entre equipos. Cada máquina tiene sus propios datos,
así que para compartir hay que usar **Exportar respaldo** e **Importar respaldo**.
