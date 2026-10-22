# Referencia de ajustes

Todos los ajustes de la extensión. Abre la pantalla de configuración con **RizomaDB: Abrir configuración** para cambiarlos con un formulario; cada cambio se guarda en tu configuración de usuario al hacerlo. Los ajustes marcados como *machine-overridable* también los puede fijar un administrador.

| Ajuste | Tipo | Por defecto | Qué hace |
|---|---|---|---|
| `rizomadb.language` | string (`auto`, `en`, `es`, `pt`, `fr`) | `auto` | Idioma de las pantallas y mensajes de RizomaDB: `auto` sigue el idioma de VS Code, o fuerza `en`, `es`, `pt` (portugués de Brasil) o `fr`. Los nombres de comandos y ajustes siempre siguen a VS Code. |
| `rizomadb.environments` | list | `[]` | Entornos adicionales además de dev, staging y prod, p. ej. `{ "name": "qa", "protection": "confirm" }`. Protección: `none`, `confirm` (preguntar antes de cada escritura) o `readOnly` (bloquear escrituras). También puedes crear uno desde la pantalla Nueva conexión. |
| `rizomadb.editor.codeLens` | boolean | `true` | Muestra botones Ejecutar y Explicar sobre cada sentencia de los editores de consultas, además de Ejecutar todo y la conexión en uso. |
| `rizomadb.editor.highlightStatement` | boolean | `true` | Resalta la sentencia bajo el cursor en los editores de consultas. |
| `rizomadb.explorer.groupByFamily` | boolean | `true` | Agrupa las conexiones del árbol por tipo de motor (relacional, documentos, clave-valor…). |
| `rizomadb.results.location` | string (`bottom`, `full`, `beside`) | `bottom` | Dónde aparecen los resultados y las tablas abiertas: `bottom` (mitad inferior bajo el editor, por defecto), `full` (toda el área del editor) o `beside` (al lado del editor). |
| `rizomadb.security.confirmDestructive` | boolean | `true` | Pedir confirmación antes de sentencias destructivas (DROP, TRUNCATE, UPDATE/DELETE sin WHERE). El bloqueo por solo lectura nunca depende de este ajuste. |
| `rizomadb.security.prodReadOnlyByDefault` | boolean | `true` | Tratar las conexiones etiquetadas `prod` como de solo lectura. |
| `rizomadb.query.pageSize` | number | `1000` | Filas cargadas por página en los resultados de consulta. «Cargar más» en la vista de resultados trae la siguiente página en todos los motores. |
| `rizomadb.query.keysetPaging` | boolean | `false` | Pagina las tablas por su clave primaria en vez de saltar filas. «Cargar más» empieza justo después de la última fila, así que sigue rápido en tablas grandes. Al abrir una tabla se ordena por su clave. Solo SQLite, PostgreSQL, MySQL, SQL Server y Oracle; los demás motores y las tablas sin clave primaria siguen saltando filas. Un orden propio en el filtro también salta filas. |
| `rizomadb.query.maxRows` | number | `100000` | Máximo de filas que se conservan en una vista de resultados sumando todas las páginas cargadas. |
| `rizomadb.query.timeoutSeconds` | number | `0` | Tiempo de espera de consultas en segundos (0 = sin límite). |
| `rizomadb.history.enabled` | boolean | `true` | Registrar las sentencias ejecutadas en un historial local (los secretos se redactan). |
| `rizomadb.history.retentionDays` | number | `90` | Días que se conservan las entradas del historial. |
| `rizomadb.edit.applyImmediately` | boolean | `false` | Guarda cada edición de celda en cuanto la confirmas, sin pulsar Aplicar. En conexiones `dev` se aplica sin preguntar; los demás entornos siguen preguntando, y las políticas y el solo lectura siempre se respetan. |
| `rizomadb.table.openRows` | number | `200` | Filas cargadas al abrir una tabla. |
| `rizomadb.policy.team` | object | `{}` | Capa de política de equipo (mismo formato que `.rizomadb/policy.json`). Despliégala con ajustes gestionados de VS Code; las capas de proyecto y usuario solo pueden endurecerla. |
| `rizomadb.catalog.teamFile` | string | *(empty)* | Ruta de un catálogo compartido de conexiones (sin secretos). |
| `rizomadb.audit.enabled` | boolean | `true` | Escribir un registro de auditoría local de cada sentencia (sin literales). |
| `rizomadb.audit.path` | string | *(empty)* | Ruta del archivo de auditoría (por defecto, la carpeta de almacenamiento de la extensión). |
| `rizomadb.audit.includeValues` | boolean | `false` | Conservar los valores literales en la auditoría. Desactivado por defecto para que el registro no contenga datos. |
| `rizomadb.mcp.autoRegister` | boolean | `false` | Ofrece el servidor MCP de solo lectura de RizomaDB al cliente MCP de VS Code cuando una carpeta tiene `.rizomadb/mcp.json` (creado con *RizomaDB: Generate MCP Configuration*). Desactivado por defecto; la contraseña de la base de datos se pide al iniciar el servidor. |
| `rizomadb.ai.enabled` | boolean | `false` | Activa la asistencia con IA. Desactivada por defecto: no se envía nada hasta que la actives y confirmes cada petición remota. |
| `rizomadb.ai.provider` | string (`openai-compatible`, `anthropic`) | `openai-compatible` | Estilo de API: `openai-compatible` (Ollama, LM Studio, OpenAI, …) o `anthropic`. |
| `rizomadb.ai.endpoint` | string | `http://localhost:11434/v1` | URL base de la API del modelo. Los endpoints locales (localhost) no sacan nada de tu equipo. |
| `rizomadb.ai.model` | string | `llama3.1` | Nombre del modelo a solicitar. |
| `rizomadb.ai.redactLiterals` | boolean | `true` | Sustituye los valores literales de tu SQL por `?` antes de incluirlo en una petición. |

*Generado por `scripts/gen-reference.mjs` a partir del manifiesto de la extensión; no se edita a mano.*
