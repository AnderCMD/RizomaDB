# Conexiones

## La pantalla Nueva conexión
**RizomaDB: Nueva conexión** abre una pantalla con cada motor como una tarjeta con su logo, agrupadas por tipo. Elige una y rellena el formulario.

- **Valores por defecto por motor.** El host, el puerto y el usuario habitual ya están (por ejemplo PostgreSQL `postgres@localhost:5432/postgres`, MySQL y MariaDB `root`, SQL Server `sa`, Oracle `system` con servicio `FREEPDB1`, MongoDB y Redis sin usuario). Los campos que un motor no necesita quedan vacíos y opcionales.
- **TLS en tu propia máquina.** Para `localhost`, `127.0.0.1` y `::1` la casilla de TLS empieza desmarcada, porque los servidores locales rara vez hablan TLS, y no se muestra ninguna advertencia. Si cambias el host a uno remoto vuelve al valor del motor; desmarcar TLS en un host remoto pide confirmación.
- **Probar conexión** conecta y hace ping sin guardar nada. **Guardar conexión** almacena el perfil y conecta; si falla puedes corregir los campos y reintentar, o elegir **Guardar sin conectar**.
- Las contraseñas, tokens y claves van al **almacén de secretos** de VS Code. Un catálogo compartido nunca los contiene: cada persona escribe los suyos.

### Entornos y protección
Cada conexión tiene un entorno. `prod` es de solo lectura por defecto y `staging` pregunta antes de cada escritura. Elige **Nuevo entorno…** en el formulario para crear el tuyo: dale un nombre (minúsculas, números y guiones) y una protección:

| Protección | Efecto |
|---|---|
| Preguntar antes de cada escritura | Una confirmación por cada sentencia que cambia datos |
| Bloquear escrituras | El entorno es de solo lectura |
| Sin protección | Nada adicional |

Los entornos nuevos se guardan en el ajuste `rizomadb.environments`, donde también puedes editarlos. Solo pueden hacer las cosas más estrictas que tus archivos de política, nunca más laxas. Mira [Políticas](/es/empresa/politicas).

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

## Importar desde otras herramientas
**RizomaDB: Importar conexiones de otras herramientas…** lee cadenas de conexión, `~/.pgpass`, `~/.my.cnf` y archivos de DBeaver y SQLTools. Mira [Migración](/es/guias/migracion).

## Compartir conexiones con un equipo
Un archivo de catálogo (`.rizomadb/connections.json` en el proyecto, o el archivo indicado en `rizomadb.catalog.teamFile`) lista conexiones sin secretos; cada persona agrega su propia contraseña la primera vez. Las entradas compartidas son de solo lectura en la interfaz.
