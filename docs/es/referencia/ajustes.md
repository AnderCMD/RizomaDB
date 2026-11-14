<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Referencia de ajustes

Todos los ajustes de la extensión. Abre la pantalla de configuración con **RizomaDB: Abrir configuración** para cambiarlos con un formulario; cada cambio se guarda en tu configuración de usuario al hacerlo. Los ajustes marcados como *machine-overridable* también los puede fijar un administrador.

| Ajuste | Tipo | Por defecto | Qué hace |
|---|---|---|---|
| `rizomadb.language` | string (`auto`, `en`, `es`) | `auto` | Idioma de las pantallas y mensajes de RizomaDB: `auto` sigue el idioma de VS Code, o fuerza `en` o `es`. Los nombres de comandos y ajustes siempre siguen a VS Code. |
| `rizomadb.environments` | lista | `[]` | Entornos adicionales además de dev, staging y prod, p. ej. `{ "name": "qa", "protection": "confirm" }`. Protección: `none`, `confirm` (preguntar antes de cada escritura) o `readOnly` (bloquear escrituras). También puedes crear uno desde la pantalla Nueva conexión. |
| `rizomadb.format.keywordCase` | string (`upper`, `lower`, `preserve`) | `upper` | Mayúsculas o minúsculas de las palabras clave de SQL (`SELECT`, `FROM`…) al formatear una consulta. `preserve` las deja como las escribiste. La sangría siempre sigue al editor: `editor.tabSize` y `editor.insertSpaces` (o los ajustes de `[sql]` y la sangría detectada). Como todos los ajustes `rizomadb.format.*`, se puede definir por espacio de trabajo o dentro de `"[sql]"`. |
| `rizomadb.format.dataTypeCase` | string (`upper`, `lower`, `preserve`) | `preserve` | Mayúsculas o minúsculas de los tipos de datos (`integer`, `varchar`…) al formatear una consulta. |
| `rizomadb.format.functionCase` | string (`upper`, `lower`, `preserve`) | `preserve` | Mayúsculas o minúsculas de los nombres de función (`count`, `coalesce`…) al formatear una consulta. |
| `rizomadb.format.indentStyle` | string (`standard`, `tabularLeft`, `tabularRight`) | `standard` | Disposición de las consultas formateadas. `standard` pone cada cláusula en su propia línea y sangra su contenido; `tabularLeft` y `tabularRight` alinean el contenido en una columna tras las palabras clave (alineado con espacios aunque el editor sangre con tabuladores). |
| `rizomadb.format.logicalOperatorNewline` | string (`before`, `after`) | `before` | Si `AND` y `OR` empiezan una línea nueva (`before`) o terminan la anterior (`after`) al formatear una consulta. |
| `rizomadb.format.expressionWidth` | number | `50` | Las expresiones entre paréntesis de hasta estos caracteres se quedan en una línea al formatear una consulta; las más largas se dividen. |
| `rizomadb.format.linesBetweenQueries` | number | `1` | Líneas vacías entre sentencias al formatear una consulta. |
| `rizomadb.format.denseOperators` | boolean | `false` | Escribe los operadores sin espacios alrededor (`a=1` en vez de `a = 1`) al formatear una consulta. |
| `rizomadb.format.newlineBeforeSemicolon` | boolean | `false` | Pone el `;` final de cada sentencia en su propia línea al formatear una consulta. |
| `rizomadb.editor.codeLens` | boolean | `true` | Muestra botones Ejecutar y Explicar sobre cada sentencia de los editores de consultas, además de Ejecutar todo y la conexión en uso. |
| `rizomadb.editor.highlightStatement` | boolean | `true` | Resalta la sentencia bajo el cursor en los editores de consultas. |
| `rizomadb.explorer.groupByFamily` | boolean | `true` | Agrupa las conexiones del árbol por tipo de motor (relacional, documentos, clave-valor…). |
| `rizomadb.results.location` | string (`bottom`, `full`, `beside`) | `bottom` | Dónde aparecen los resultados y las tablas abiertas: `bottom` (mitad inferior bajo el editor, por defecto), `full` (toda el área del editor) o `beside` (al lado del editor). |
| `rizomadb.security.confirmDestructive` | boolean | `true` | Pedir confirmación antes de sentencias destructivas (DROP, TRUNCATE, UPDATE/DELETE sin WHERE). El bloqueo por solo lectura nunca depende de este ajuste. |
| `rizomadb.security.prodReadOnlyByDefault` | boolean | `true` | Tratar las conexiones etiquetadas `prod` como de solo lectura. |
| `rizomadb.query.pageSize` | number | `1000` | Filas cargadas por página en los resultados de consulta. «Cargar más» en la vista de resultados trae la siguiente página en todos los motores. |
| `rizomadb.query.keysetPaging` | boolean | `true` | Pagina las tablas por su clave primaria en vez de saltar filas. «Cargar más» empieza justo después de la última fila, así que sigue rápido en tablas grandes. Al abrir una tabla se ordena por su clave. Solo SQLite, PostgreSQL, MySQL, SQL Server y Oracle; los demás motores y las tablas sin clave primaria siguen saltando filas. Un orden propio en el filtro también salta filas. |
| `rizomadb.query.maxRows` | number | `100000` | Máximo de filas que se conservan en una vista de resultados sumando todas las páginas cargadas. |
| `rizomadb.query.timeoutSeconds` | number | `0` | Tiempo de espera de consultas en segundos (0 = sin límite). |
| `rizomadb.connections.idleMinutes` | number | `30` | Cierra una conexión que nadie ha usado durante estos minutos; se reconecta la próxima vez que la uses (0 = no cerrar automáticamente). |
| `rizomadb.history.enabled` | boolean | `true` | Registrar las sentencias ejecutadas en un historial local (los secretos se redactan). |
| `rizomadb.history.retentionDays` | number | `90` | Días que se conservan las entradas del historial. |
| `rizomadb.edit.applyImmediately` | boolean | `false` | Guarda cada edición de celda en cuanto la confirmas, sin pulsar Aplicar. En conexiones `dev` se aplica sin preguntar; los demás entornos siguen preguntando, y las políticas y el solo lectura siempre se respetan. |
| `rizomadb.edit.withoutPrimaryKey` | boolean | `true` | Permite editar tablas sin clave primaria (motores SQL con transacciones). Las filas se identifican por un índice único sobre columnas NOT NULL si existe; si no, por los valores de sus columnas (no se comparan columnas de coma flotante, fecha/hora, binarias, JSON ni objetos grandes). Cada cambio debe coincidir con una sola fila: si coinciden dos filas idénticas, se deshace todo el lote. |
| `rizomadb.table.openRows` | number | `200` | Filas cargadas al abrir una tabla. |
| `rizomadb.policy.team` | object | `{}` | Capa de política de equipo (mismo formato que `.rizomadb/policy.json`). Despliégala con ajustes gestionados de VS Code; las capas de proyecto y usuario solo pueden endurecerla. |
| `rizomadb.catalog.teamFile` | string | *(vacío)* | Ruta de un catálogo compartido de conexiones (sin secretos). |
| `rizomadb.audit.enabled` | boolean | `true` | Escribir un registro de auditoría local de cada sentencia (sin literales). |
| `rizomadb.audit.path` | string | *(vacío)* | Ruta del archivo de auditoría (por defecto, la carpeta de almacenamiento de la extensión). |
| `rizomadb.audit.includeValues` | boolean | `false` | Conservar los valores literales en la auditoría. Desactivado por defecto para que el registro no contenga datos. |
| `rizomadb.mcp.autoRegister` | boolean | `false` | Ofrece el servidor MCP de solo lectura de RizomaDB al cliente MCP de VS Code cuando una carpeta tiene `.rizomadb/mcp.json` (creado con *RizomaDB: Generate MCP Configuration*). Desactivado por defecto; la contraseña de la base de datos se pide al iniciar el servidor. |
| `rizomadb.ai.enabled` | boolean | `false` | Activa la asistencia con IA. Desactivada por defecto: no se envía nada hasta que la actives y confirmes cada petición remota. |
| `rizomadb.ai.provider` | string (`openai-compatible`, `anthropic`) | `openai-compatible` | Estilo de API: `openai-compatible` (Ollama, LM Studio, OpenAI, …) o `anthropic`. |
| `rizomadb.ai.endpoint` | string | `http://localhost:11434/v1` | URL base de la API del modelo. Los endpoints locales (localhost) no sacan nada de tu equipo. |
| `rizomadb.ai.model` | string | `llama3.1` | Nombre del modelo a solicitar. |
| `rizomadb.ai.redactLiterals` | boolean | `true` | Sustituye los valores literales de tu SQL por `?` antes de incluirlo en una petición. |

*Generado por `scripts/gen-reference.mjs` a partir del manifiesto de la extensión; no se edita a mano.*
