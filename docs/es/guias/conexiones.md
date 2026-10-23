<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Conexiones

## La pantalla Nueva conexión
**RizomaDB: Nueva conexión** abre una pantalla con cada motor como una tarjeta con su logo, agrupadas por tipo. Elige una y rellena el formulario.

- **Valores por defecto por motor.** El host, el puerto y el usuario habitual ya están (por ejemplo PostgreSQL `postgres@localhost:5432/postgres`, MySQL y MariaDB `root`, SQL Server `sa`, Oracle `system` con servicio `FREEPDB1`, MongoDB y Redis sin usuario). Los campos que un motor no necesita quedan vacíos y opcionales.
- **TLS en tu propia máquina.** Para `localhost`, `127.0.0.1` y `::1` la casilla de TLS empieza desmarcada, porque los servidores locales rara vez hablan TLS, y no se muestra ninguna advertencia. Si cambias el host a uno remoto vuelve al valor del motor; desmarcar TLS en un host remoto pide confirmación.
- **Probar conexión** conecta y hace ping sin guardar nada. **Guardar conexión** almacena el perfil y conecta; si falla puedes corregir los campos y reintentar, o elegir **Guardar sin conectar**.
- **Los servicios en la nube no están confirmados.** RizomaDB solo se ha probado con motores locales y emuladores oficiales, nunca con una cuenta real en la nube (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gestionados). Prueba primero con un usuario de solo lectura o una base de datos desechable; ver [Motores](../motores/README.md#nube-y-servicios-gestionados-sin-confirmar).
- Las contraseñas, tokens y claves van al **almacén de secretos** de VS Code. Un catálogo compartido nunca los contiene: cada persona escribe los suyos.

### Entornos y protección
Cada conexión tiene un entorno. `prod` es de solo lectura por defecto y `staging` pregunta antes de cada escritura. Elige **Nuevo entorno…** en el formulario para crear el tuyo: dale un nombre (minúsculas, números y guiones) y una protección:

| Protección | Efecto |
|---|---|
| Preguntar antes de cada escritura | Una confirmación por cada sentencia que cambia datos |
| Bloquear escrituras | El entorno es de solo lectura |
| Sin protección | Nada adicional |

Los entornos nuevos se guardan en el ajuste `rizomadb.environments`, donde también puedes editarlos. Solo pueden hacer las cosas más estrictas que tus archivos de política, nunca más laxas. Mira [Políticas](../empresa/politicas.md).

### Ruta de red
Por defecto RizomaDB conecta directamente. En **Ruta de red** puedes pasar por un **túnel SSH** (archivo de clave o contraseña, con verificación estricta de la huella del host y aviso ante hosts desconocidos) o por un **proxy HTTP** / **proxy SOCKS5** (con usuario y contraseña opcionales). Una conexión usa un túnel SSH *o* un proxy, no ambos.

## Conexiones guardadas
La segunda pestaña de la misma pantalla lista las conexiones que tienes. Cada tarjeta muestra el logo del motor, el entorno, si es de solo lectura o compartida, el destino (`host:puerto`), su **base de datos** y si está conectada. Una insignia **● Activa** marca la que está en uso. Los botones conectan o desconectan, abren una consulta nueva, alternan el solo lectura y eliminan.

## El árbol de conexiones
- Las conexiones se agrupan por tipo de motor (desactívalo con `rizomadb.explorer.groupByFamily`).
- Cada fila lleva el logo del motor, `[ENTORNO]`, la base de datos y un punto para la activa.
- Bajo una conexión: **Tablas** (o Colecciones, Claves, Índices, Etiquetas, Mediciones, según el motor) con su cantidad, y **Vistas**.
- Pasa el mouse sobre una fila para ver botones rápidos. El título de la vista tiene botones para nueva conexión, actualizar, importar, configuración, la guía y **contraer todo**.

## La conexión en uso
La conexión *activa* es la asociada al editor de consultas en el que estás, o la última que ejecutó algo. La barra de estado la muestra como `[ENTORNO] nombre · base de datos`; haz clic para cambiar la conexión del editor actual.

## Una cuenta de solo lectura para la garantía en el servidor
Marcar una conexión como de solo lectura lo aplica RizomaDB (y el servidor cuando el motor lo permite). Para una garantía que no dependa de ningún cliente, dale a la conexión una cuenta de base de datos que solo pueda leer. Haz clic derecho en la conexión y elige **Generar script de usuario de solo lectura…**: eliges el nombre de la cuenta y RizomaDB abre un script en un editor. Nunca lo ejecuta ni escribe una contraseña: sustituye el marcador `<choose-a-password>` y ejecútalo con una cuenta de administrador. Disponible para PostgreSQL, MySQL/MariaDB, ClickHouse y Redis/Valkey; cada script se ejecutó contra un servidor real y se comprobó que la cuenta nueva lee y que se le rechazan las escrituras (los demás motores lo avisan en lugar de adivinar).

## Pegar una URL JDBC
La mayoría de los motores con driver JDBC muestran arriba del formulario un cuadro **URL JDBC**. Pega una URL que empiece por `jdbc:` y pulsa **Rellenar el formulario** (o Enter): el host, el puerto, la base de datos, el usuario y las opciones se copian a los campos de abajo y puedes revisarlos antes de guardar. No se conecta ni se guarda nada hasta que pulsas **Probar conexión** o **Guardar conexión**.

| Motor | Formas que entiende |
|---|---|
| Oracle | `jdbc:oracle:thin:@//host:1521/servicio`, `@host:1521/servicio`, `@host:1521:SID` (SID antiguo), `usuario/contraseña@…` y un `(DESCRIPTION=…)` completo (se usa la primera dirección) |
| PostgreSQL, CockroachDB, YugabyteDB | `jdbc:postgresql://host:5432/db?sslmode=…&sslrootcert=…`, también `jdbc:postgresql:db` y varios hosts (se usa el primero) |
| MySQL, MariaDB, TiDB | `jdbc:mysql://…`, `jdbc:mariadb://…` con `sslMode`, `useSSL` y `verifyServerCertificate` |
| SQL Server | `jdbc:sqlserver://host:1433;databaseName=db;user=…;encrypt=…;trustServerCertificate=…` |
| SQLite, DuckDB | `jdbc:sqlite:/ruta/al/archivo.db`, `jdbc:duckdb:/ruta/al/archivo.db` |
| ClickHouse, Trino, Cassandra, Elasticsearch/OpenSearch, Redis/Valkey, Neo4j, MongoDB | `jdbc:clickhouse://…`, `jdbc:trino://…/catalogo/esquema`, `jdbc:cassandra://…`, `jdbc:es://…`, `jdbc:redis://…`, `jdbc:neo4j://…`, `jdbc:mongodb://…` |

- **Contraseñas.** Una contraseña dentro de la URL va al campo de contraseña, nunca queda en el cuadro de la URL, y solo se guarda en el almacenamiento secreto de VS Code cuando guardas. El cuadro se vacía después de rellenar.
- **Lo que se rechaza, con motivo.** No se admiten las URL Oracle OCI (thick), los alias TNS ni TCPS (TLS); tampoco la seguridad integrada de SQL Server (Windows); un subprotocolo para el que RizomaDB no tiene conexión (por ejemplo DB2) se rechaza. Si la URL es de otro tipo de base de datos que el que elegiste, te pide elegir primero ese motor.
- **Avisos.** Si algo de la URL no se usa (por ejemplo el nombre de instancia de SQL Server, el puerto Bolt de Neo4j o una opción desconocida) el formulario indica qué se ignoró.
- **Probado.** La lectura de cada forma de la tabla tiene pruebas unitarias. Conectar desde una URL también se probó contra servidores reales de PostgreSQL, MySQL, SQL Server y Oracle (nombre de servicio, SID y descriptor); los demás motores se prueban como antes, pero no se conectaron desde una URL.

El mismo lector lo usa **RizomaDB: Importar conexiones de otras herramientas…** cuando le das una URL `jdbc:` o cuando un archivo de DBeaver contiene una.

## Editar una conexión guardada
En **Conexiones guardadas**, pulsa el lápiz de una tarjeta. Se abre el mismo formulario con los datos, la contraseña y los ajustes de túnel o proxy; usa el botón del ojo junto a una contraseña para mostrarla u ocultarla. **Guardar cambios** conserva el id, las etiquetas y la elección de solo lectura de la conexión. Si estaba abierta se cierra, para que la próxima conexión use los valores nuevos. Pulsa **Probar conexión** antes si quieres comprobar los cambios: una prueba fallida nunca toca la conexión guardada. Las conexiones de un catálogo compartido no se pueden editar aquí.

## Solo lectura y editable
El botón del candado de una conexión guardada (o **RizomaDB: Alternar solo lectura**) la cambia entre solo lectura y editable. Las conexiones de `prod` empiezan en solo lectura; pasar una a editable pide confirmación y cada escritura sigue pidiéndola. Una política (archivo de equipo, proyecto o usuario, o un entorno con «Bloquear escrituras») que prohíba escribir no se puede saltar así: el candado explica que una política lo bloquea. El ajuste *Producción es de solo lectura por defecto* quita ese estado inicial para todas las conexiones `prod`.

## Importar desde otras herramientas
**RizomaDB: Importar conexiones de otras herramientas…** lee cadenas de conexión, `~/.pgpass`, `~/.my.cnf` y archivos de DBeaver y SQLTools. Mira [Migración](migracion.md).

## Llevar conexiones en un archivo sellado
**Exportar conexiones (cifradas)…** escribe tus conexiones guardadas en un archivo `.rzcat` sellado con una frase de paso que eliges (AES-256-GCM, clave derivada con scrypt); **Importar conexiones (cifradas)…** lo lee. El archivo solo contiene perfiles: las contraseñas siguen en el almacenamiento secreto de cada persona y se piden en la primera conexión. Una frase de paso incorrecta o un archivo alterado se rechazan por completo, y las conexiones cuyo id ya existe se omiten. Puedes enviar el archivo por cualquier canal; guarda la frase de paso aparte.

## Compartir conexiones con un equipo
Un archivo de catálogo (`.rizomadb/connections.json` en el proyecto, o el archivo indicado en `rizomadb.catalog.teamFile`) lista conexiones sin secretos; cada persona agrega su propia contraseña la primera vez. Las entradas compartidas son de solo lectura en la interfaz.
