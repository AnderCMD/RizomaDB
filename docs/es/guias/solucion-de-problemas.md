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

¿Sigues atascado? El canal de salida *RizomaDB policy* y la barra de estado muestran qué está bloqueando una acción. Abre una incidencia con el motor, la versión y los pasos.
