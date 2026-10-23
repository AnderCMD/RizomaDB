<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Solución de problemas

**No puedo editar una celda.** Solo se pueden editar las tablas con clave primaria (o documentos de MongoDB) abiertas desde el árbol. Las vistas, las consultas personalizadas, una línea de consulta que editaste y las conexiones de solo lectura no; la rejilla explica cuál aplica. Comprueba que la conexión no sea de solo lectura y que el entorno no sea `prod` con protección de solo lectura.

**La conexión falla en localhost con un error de TLS.** Para `localhost` el formulario desmarca TLS por defecto. Si guardaste una conexión antes con TLS activado, edítala o créala de nuevo. Los servidores reales suelen necesitar TLS; mira la página del motor.

**«Cargar más» nunca aparece.** No hay más filas, o se alcanzó el límite de filas (`rizomadb.query.maxRows`); el pie dice cuál. Las sentencias que no son lecturas no devuelven filas que paginar.

**Las páginas repiten o se saltan filas.** La paginación vuelve a ejecutar la consulta y salta las filas ya mostradas, así que sin un `ORDER BY` el motor puede devolver las filas en otro orden. Ordena el resultado en la consulta o en el cuadro de orden.

**Se rechaza un filtro.** El texto no puede contener `;`, comentarios ni corchetes sin pareja. Escribe una sola condición.

**El árbol no muestra tablas de HydraDB.** HydraDB no puede listar etiquetas. Escribe las que quieras en el campo *Etiquetas que se muestran en el árbol* de la conexión.

**HydraDB responde «internal query execution error».** Casi siempre es un **ID de celda** equivocado; HydraDB no puede listar celdas, así que pregunta al operador.

**Todo es de solo lectura después de editar un archivo de política.** Un archivo de política que no se puede leer hace que todas las escrituras fallen por seguridad. Abre el canal de salida *RizomaDB policy* para ver el error.

**Una pantalla está en el idioma equivocado.** Cambia `rizomadb.language` y reabre las pantallas abiertas. Los nombres de comandos y ajustes siguen el idioma de VS Code.

**Oracle dice «NJS-138» o que el servidor es demasiado antiguo.** RizomaDB se conecta sin el cliente de Oracle, que necesita Oracle Database 12.1 o posterior. Los servidores más antiguos no se admiten.

**Una pantalla dice «Could not register service worker» o se queda en blanco.** Es un problema de VS Code, no de la extensión: cierra todas las ventanas de VS Code y ábrelo de nuevo. Si se repite, cierra VS Code por completo y borra la carpeta de caché `Service Worker` (en macOS, `~/Library/Application Support/Code/Service Worker`).

**La ventana se pone lenta o se congela con una base de datos enorme.** Un nodo lista como máximo 2.000 tablas (usa **Abrir datos de la tabla** desde la paleta de comandos para llegar a cualquiera), y el autocompletado SQL lee solo nombres de tablas en esquemas de más de 1.500 tablas. Un servidor que no responde se abandona a los 45 segundos. Si aun así pasa, dinos el motor, cuántas tablas tiene y qué hiciste justo antes.

**Un archivo `.sql` grande (un volcado de datos) no muestra errores subrayados ni autocompletado.** Los archivos de más de 1 MB no se analizan, porque hacerlo en cada pulsación detendría VS Code. Los botones de ejecutar y la ejecución de sentencias siguen funcionando.

**El formulario de conexión volvía a «Nueva conexión» al cambiar de pestaña.** Corregido en 1.2.2: la pantalla ahora conserva lo que escribiste. Actualiza la extensión.

¿Sigues atascado? El canal de salida *RizomaDB policy* y la barra de estado muestran qué está bloqueando una acción. Abre una incidencia con el motor, la versión y los pasos.
