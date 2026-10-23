<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# La rejilla de resultados

Abrir una tabla o ejecutar una consulta muestra las filas en una rejilla hecha para explorar. Cada botón es un icono con una etiqueta al pasar el mouse o enfocarlo.

## Anatomía
1. **Cabecera**: la conexión (logo, nombre, entorno), la tabla y un estado como `1 000 filas · 12 ms · hay más filas`.
2. **Pestañas** (solo para tablas): **Datos**, **Propiedades**, **Relaciones**, **DDL**.
3. **Línea de consulta**: la sentencia que produjo las filas. **Es editable.**
4. **Barra de filtro** (tablas de los motores soportados): filtra y ordena en la base de datos.
5. **Barra de herramientas**: buscar, filtros por columna, mostrar/ocultar columnas, panel de registro, filas compactas, copiar, guardar, ejecutar de nuevo, atajos.
6. **Barra de edición** (resultados editables): editar, agregar fila, eliminar, deshacer, rehacer, revisar SQL, descartar, **Aplicar**.
7. **La rejilla**, y un **pie** con el número de filas, el tiempo y estadísticas de la columna seleccionada.

## La línea de consulta
Cambia el texto y pulsa el botón de reproducir o **Ctrl/⌘+Enter** para ejecutarla; **Esc** devuelve el original. El texto editado es una **consulta nueva**: ya no dice qué tabla muestra, así que su resultado es de solo lectura. Si tienes ediciones pendientes se te pregunta antes de descartarlas. El texto sin cambios solo vuelve a ejecutar la vista de la tabla. Los otros dos botones copian la consulta o la abren en un editor normal.

## Filtrar en la base de datos
Para las tablas, una barra bajo la línea de consulta cambia la propia sentencia, así que la paginación y la edición siguen funcionando:

| Motor | Cuadro de filtro | Cuadro de orden |
|---|---|---|
| Motores SQL | una condición: `age > 30 AND city = 'Lima'` | `name DESC` |
| MongoDB | una consulta Mongo: `{ "status": "A" }` | un orden: `{ "total": -1 }` |
| Elasticsearch / OpenSearch | texto de búsqueda: `level:error` | `timestamp:desc` |
| Neo4j | una condición sobre `n`: `n.age > 30` | `n.name` |

Pulsa Enter (o el botón de la marca) para aplicar y **Esc** (o la cruz) para quitar. El texto lo coloca en una sentencia una sola función comprobada: se rechazan `;`, los comentarios y los corchetes sin pareja, y la sentencia sigue pasando por la política. Es distinto del **embudo de la barra de herramientas**, que filtra solo las filas ya cargadas.

## Trabajar con columnas
Haz clic en el nombre de una columna para **ordenar** (ascendente, descendente, ninguno). Arrastra el borde para **cambiar el ancho** (doble clic ajusta al contenido). El menú **⋮** de un encabezado, o el clic derecho sobre él, ofrece: ordenar, quitar el orden, filtrar esta columna, ajustar el ancho, ocultar, **estadísticas de la columna…**, copiar el nombre, copiar los valores. *Estadísticas de la columna* abre un panel con el número de valores, nulos y valores distintos, el mínimo y el máximo (y el promedio y la suma si es numérica) y un gráfico de barras: los valores más frecuentes, o un histograma si la columna es numérica y tiene muchos valores distintos. Se calcula sobre las filas que muestra la rejilla (los filtros cuentan), no sobre toda la tabla. Las columnas ocultas vuelven desde el botón de columnas. Los anchos y las columnas ocultas se recuerdan por forma de resultado.

Para las tablas SQL el mismo menú puede cambiar la estructura: **Renombrar columna…**, **Cambiar tipo…**, **Alternar NOT NULL**, **Definir valor por defecto…**, **Agregar columna…**, **Eliminar columna…**. Cada una muestra el SQL exacto y pide confirmación; los cambios destructivos se marcan y las políticas se aplican. SQLite no puede alterar algunas cosas in situ y te lo dice.

## Celdas, filas y el panel de registro
- Clic derecho en una celda: copiar, copiar la fila como JSON, filtrar por este valor, abrir el panel de registro, editar, poner NULL, poner texto vacío, eliminar la fila.
- Haz clic en el número a la izquierda de una fila para seleccionarla; Ctrl/⌘ alterna y Shift selecciona un rango. **Seleccionar todo** es la marca de la esquina.
- **Panel de registro** (Alt+Enter): una fila como formulario, con anterior/siguiente, copiar como JSON, botones de copiar y NULL por campo y formato JSON.
- Los booleanos muestran ✓/✗, los números van alineados a la derecha, NULL y DEFAULT están marcados, y la clave (🔑) y NOT NULL (*) se marcan en la cabecera.

## Copiar y guardar
Los botones de copiar y guardar exportan **lo que ves** (columnas visibles, orden y filtro actuales) o solo las filas seleccionadas, como **CSV, TSV, JSON o Markdown**. Para resultados muy grandes usa **Exportar datos…**, que escribe en un archivo en flujo.

## Paginación
Una tabla se abre con una primera página (`rizomadb.table.openRows`, 200); una consulta empieza con `rizomadb.query.pageSize` (1000). Si hay más filas, el pie muestra **Cargar N más** y **Cargar todo**; las filas nuevas se añaden sin perder tu orden, filtros ni selección. `rizomadb.query.maxRows` (100 000) es el máximo de filas que se conservan en una vista; pasado eso el pie te dice que afines la consulta o exportes.

Cómo funciona, con honestidad: la consulta se vuelve a ejecutar y se saltan las filas ya mostradas, lo que funciona en **todos** los motores. La base de datos repite el trabajo hasta ese punto, así que las páginas muy profundas son más lentas, y sin un `ORDER BY` el motor no está obligado a devolver las filas en el mismo orden dos veces. Para un resultado estable en una tabla que cambia, ordénala. Si tienes ediciones pendientes debes aplicarlas o descartarlas antes de cargar más.

Activado por defecto (se apaga con `rizomadb.query.keysetPaging`): la tabla se abre ordenada por su clave primaria, y «Cargar más» pide a la base de datos las filas **posteriores** a la última clave en vez de saltar filas, así que las páginas profundas siguen tan rápidas como la primera. Está probado en SQLite, PostgreSQL, MySQL, SQL Server y Oracle; los demás motores, las tablas sin clave primaria, las claves que no son números o texto y un orden propio escrito en el filtro siguen saltando filas. Como la tabla queda ordenada por su clave, el orden de las filas difiere del orden natural del motor. Sin esto, cada «Cargar más» volvería a ejecutar la sentencia y leería y descartaría todas las filas ya mostradas, lo que se vuelve lento en tablas con millones de filas.

## Fijar una pestaña de resultados
Pulsa la **chincheta** de la barra de resultados (o ejecuta **RizomaDB: Fijar pestaña de resultados**) para conservar los resultados que estás viendo. La pestaña se queda como está y la siguiente consulta se abre en otra pestaña de resultados. Una pestaña fijada lleva 📌 en el título; ciérrala cuando ya no la necesites.

## Dónde se abren los resultados
`rizomadb.results.location`: `bottom` (la mitad inferior bajo el editor, por defecto), `full` (toda el área del editor) o `beside`.

## Atajos
| Teclas | Acción |
|---|---|
| Flechas, Inicio/Fin, RePág/AvPág | Moverse entre celdas |
| Shift + ↑/↓ | Ampliar la selección de filas |
| Espacio | Seleccionar o quitar la fila |
| Ctrl/⌘ + A | Seleccionar todas las filas |
| Enter, F2, doble clic | Editar la celda |
| Supr | Poner NULL, o eliminar las filas seleccionadas |
| Ctrl/⌘ + Z / Y | Deshacer / rehacer |
| Ctrl/⌘ + C | Copiar la celda o las filas seleccionadas |
| Ctrl/⌘ + F | Buscar en los resultados |
| Alt + Enter | Panel de registro |
| Shift + F10 | Menú contextual |
| Esc | Quitar la selección |

El botón del teclado de la barra de herramientas los lista dentro de la aplicación.
