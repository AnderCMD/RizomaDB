<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# El editor de consultas

**RizomaDB: Nueva consulta** abre un editor en el lenguaje de la conexión: SQL, shell de Mongo, comandos de Redis, Cypher (Neo4j, HydraDB), solicitudes REST para Elasticsearch/OpenSearch y la consola JSON de Firestore, o Flux y CQL donde corresponda. Elige la conexión con el elemento de la barra de estado o con la primera lente del editor.

## Construir una consulta sin escribir SQL
Haz clic derecho en una conexión SQL y elige **Construir una consulta…**: eliges la tabla, las columnas a mostrar, las condiciones que quieras (columna, operador, valor; `IN` admite una lista separada por comas), el orden y el límite de filas. RizomaDB abre el `SELECT` resultante en un editor ligado a esa conexión; no lo ejecuta. Los valores se convierten en literales del tipo de la columna (un valor que no encaja, como texto en un número, se rechaza), los nombres los entrecomilla el driver y la sentencia se comprobó contra PostgreSQL y MySQL reales, con comillas, barras invertidas y acentos en el texto. Los demás motores SQL usan el mismo código pero no tienen prueba.

## Ejecutar
| Acción | Cómo |
|---|---|
| Ejecutar la sentencia bajo el cursor | **Ctrl+Enter** (⌘+Enter), o la lente **Ejecutar** encima de ella |
| Ejecutar la selección | **Ctrl+Shift+Enter** (⌘+Shift+Enter) |
| Ejecutar todas las sentencias | Lente **Ejecutar todo (N)** al inicio del archivo, o **RizomaDB: Ejecutar todas las sentencias** |
| Explicar el plan (motores SQL que lo soportan) | Lente **Explicar**, o **RizomaDB: Explicar el plan de consulta** |
| Cancelar | **RizomaDB: Cancelar la consulta en curso**, el botón de parar en la cabecera de resultados, o el elemento *Ejecutando… clic para cancelar* de la barra de estado. Si el motor no se detiene en 1,5 segundos, la ejecución se abandona, la pantalla se libera y esa conexión se cierra (se reconecta en la siguiente ejecución) |

**Ejecutar todo** y **Ejecutar la selección** corren las sentencias en orden (divididas como las divide el lenguaje del editor, pidiendo los parámetros) y se detienen en el primer error. Fuera de `dev` pide confirmación antes, una vez para todo el archivo. Cada sentencia sigue pasando por la política y el registro de auditoría por separado.

### Sentencias
- SQL se divide en los punto y coma de nivel superior (se entienden cadenas, comentarios y las comillas de dólar de PostgreSQL). Cypher también se divide en `;`.
- El shell de Mongo y la consola de los motores de búsqueda usan **bloques separados por una línea en blanco**; Redis usa **un comando por línea**. Las líneas de comentario (`//`, `#`, `--`) se ignoran, y los comentarios escritos encima de una sentencia no se envían con ella ni se muestran en los resultados ni en el historial (se conservan `/*!…*/` de MySQL y las pistas del optimizador `/*+…*/`).
- La sentencia bajo el cursor se **resalta** (`rizomadb.editor.highlightStatement`). Las lentes se pueden desactivar con `rizomadb.editor.codeLens`.

### Parámetros
Los marcadores como `:nombre`, `$1`, `@nombre` o `?` piden sus valores antes de ejecutar. Los valores son tipados (`null`, `true`, números y `"texto entre comillas"`; cualquier otra cosa es texto), los enlaza el driver y se recuerdan por conexión.

## Formato
**Dar formato al documento** (Shift+Alt+F, ⇧⌥F en macOS) y **Dar formato a la selección** formatean el SQL según el dialecto de la conexión. También funcionan `editor.formatOnSave` y `editor.formatOnPaste`.
- **La sangría sigue al editor**: `editor.tabSize` y `editor.insertSpaces`, incluidos los ajustes de `"[sql]"` y la sangría que VS Code detecta en el archivo. Si no se usan espacios, sangra con tabuladores.
- El resto se configura con `rizomadb.format.*`: mayúsculas o minúsculas de palabras clave (mayúsculas por defecto), tipos de datos y nombres de función; la disposición (`standard`, o `tabularLeft`/`tabularRight`, que alinean con espacios); si `AND`/`OR` van antes o después del salto de línea; cuánto puede medir una expresión antes de dividirse; líneas vacías entre sentencias; operadores sin espacios; y el `;` en su propia línea.
- Se pueden definir por espacio de trabajo o carpeta, o solo para los archivos SQL:

```json
"[sql]": { "editor.tabSize": 4, "rizomadb.format.keywordCase": "lower" }
```

- Una selección conserva la sangría en la que está y su salto de línea final; el texto de una cadena que ocupa varias líneas nunca se cambia. El SQL que el formateador no entiende se deja tal cual, y los archivos de más de 1 MB no se formatean (formatea una selección).

## Resultados
Los resultados se abren en la mitad inferior de la ventana (`rizomadb.results.location`). Cada ejecución reemplaza la misma pestaña; **Fijar la pestaña de resultados** la conserva. La pestaña se llama `conexión.tabla` y lleva el logo del motor. Mira [La rejilla de resultados](rejilla-de-resultados.md).

## Historial
**RizomaDB: Abrir el historial de consultas** abre una pantalla con todo lo que ejecutaste, lo más reciente primero, agrupado por día. Busca en el texto, filtra por estado (todas, favoritas, correctas, con error) o por conexión y, en cada entrada, **abre en un editor**, **ejecuta de nuevo** (si la conexión aún existe) o **copia**. La estrella de cada entrada la añade a tus **favoritas** (filtro *Favoritas*): las favoritas se guardan aparte del historial, así que **Vaciar** y el ajuste de retención nunca las eliminan (quita la estrella para borrar una). **Vaciar** borra el historial. Las sentencias y errores se guardan localmente con los secretos ocultos; `rizomadb.history.enabled` y `rizomadb.history.retentionDays` lo controlan.

## Notebooks
**Nuevo notebook SQL** crea un notebook `.sqlnb`: celdas SQL con sus resultados debajo, guardado como JSON simple.

## Seguridad
Cada sentencia se clasifica antes de ejecutarse. Las lecturas se ejecutan; las escrituras siguen el entorno (confirmación, aprobación, solo lectura); las destructivas (`DROP`, `TRUNCATE`, `UPDATE`/`DELETE` sin `WHERE`…) preguntan antes. El motivo se muestra en tu idioma. Mira [Políticas](../empresa/politicas.md).
