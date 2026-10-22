# El editor de consultas

**RizomaDB: Nueva consulta** abre un editor en el lenguaje de la conexión: SQL, shell de Mongo, comandos de Redis, Cypher (Neo4j, HydraDB), solicitudes REST para Elasticsearch/OpenSearch y la consola JSON de Firestore, o Flux y CQL donde corresponda. Elige la conexión con el elemento de la barra de estado o con la primera lente del editor.

## Ejecutar
| Acción | Cómo |
|---|---|
| Ejecutar la sentencia bajo el cursor | **Ctrl+Enter** (⌘+Enter), o la lente **Ejecutar** encima de ella |
| Ejecutar la selección | **Ctrl+Shift+Enter** (⌘+Shift+Enter) |
| Ejecutar todas las sentencias | Lente **Ejecutar todo (N)** al inicio del archivo, o **RizomaDB: Ejecutar todas las sentencias** |
| Explicar el plan (motores SQL que lo soportan) | Lente **Explicar**, o **RizomaDB: Explicar el plan de consulta** |
| Cancelar | **RizomaDB: Cancelar la consulta en curso**, o el botón de parar en la cabecera de resultados |

**Ejecutar todo** corre las sentencias en orden y se detiene en el primer error. Fuera de `dev` pide confirmación antes, una vez para todo el archivo. Cada sentencia sigue pasando por la política y el registro de auditoría por separado.

### Sentencias
- SQL se divide en los punto y coma de nivel superior (se entienden cadenas, comentarios y las comillas de dólar de PostgreSQL). Cypher también se divide en `;`.
- El shell de Mongo y la consola de los motores de búsqueda usan **bloques separados por una línea en blanco**; Redis usa **un comando por línea**. Las líneas de comentario (`//`, `#`, `--`) se ignoran.
- La sentencia bajo el cursor se **resalta** (`rizomadb.editor.highlightStatement`). Las lentes se pueden desactivar con `rizomadb.editor.codeLens`.

### Parámetros
Los marcadores como `:nombre`, `$1`, `@nombre` o `?` piden sus valores antes de ejecutar. Los valores son tipados (`null`, `true`, números y `"texto entre comillas"`; cualquier otra cosa es texto), los enlaza el driver y se recuerdan por conexión.

## Resultados
Los resultados se abren en la mitad inferior de la ventana (`rizomadb.results.location`). Cada ejecución reemplaza la misma pestaña; **Fijar la pestaña de resultados** la conserva. La pestaña se llama `conexión.tabla` y lleva el logo del motor. Mira [La rejilla de resultados](rejilla-de-resultados.md).

## Historial
**RizomaDB: Abrir el historial de consultas** abre una pantalla con todo lo que ejecutaste, lo más reciente primero, agrupado por día. Busca en el texto, filtra por estado (todas, favoritas, correctas, con error) o por conexión y, en cada entrada, **abre en un editor**, **ejecuta de nuevo** (si la conexión aún existe) o **copia**. La estrella de cada entrada la añade a tus **favoritas** (filtro *Favoritas*): las favoritas se guardan aparte del historial, así que **Vaciar** y el ajuste de retención nunca las eliminan (quita la estrella para borrar una). **Vaciar** borra el historial. Las sentencias y errores se guardan localmente con los secretos ocultos; `rizomadb.history.enabled` y `rizomadb.history.retentionDays` lo controlan.

## Notebooks
**Nuevo notebook SQL** crea un notebook `.sqlnb`: celdas SQL con sus resultados debajo, guardado como JSON simple.

## Seguridad
Cada sentencia se clasifica antes de ejecutarse. Las lecturas se ejecutan; las escrituras siguen el entorno (confirmación, aprobación, solo lectura); las destructivas (`DROP`, `TRUNCATE`, `UPDATE`/`DELETE` sin `WHERE`…) preguntan antes. El motivo se muestra en tu idioma. Mira [Políticas](/es/empresa/politicas).
