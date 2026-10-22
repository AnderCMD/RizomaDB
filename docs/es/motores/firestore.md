<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Google Cloud Firestore

**Nivel:** 2 · **Versiones probadas:** el emulador de Firestore (imagen `emulators` de Google Cloud CLI, modo Firestore Native, API REST v1) (probada). **Google Cloud en sí no se ha probado**, así que no está confirmado que funcione ahí; las peticiones son las mismas llamadas REST, con un token Bearer. Pruébalo con una cuenta de solo lectura o un proyecto desechable antes de depender de él.

## Autenticación y transporte
Emulador: sin credenciales. Google Cloud: un **token de acceso** OAuth pegado en la conexión (por ejemplo `gcloud auth print-access-token`; caduca en aproximadamente una hora). En su lugar se puede usar un **archivo de credenciales de Google** (campo, `GOOGLE_APPLICATION_CREDENTIALS` o el archivo que escribe `gcloud auth application-default login`): una clave de cuenta de servicio o un archivo de usuario autorizado. RizomaDB pide entonces por sí mismo tokens de corta duración al endpoint de tokens de Google (el `token_uri` del archivo, solo HTTPS) y los renueva; no se escribe nada en disco. Es una petición que la extensión hace en tu nombre, solo cuando te conectas a Google Cloud. La identidad de carga de trabajo, el servidor de metadatos de GCE/Cloud Run y los archivos de cuenta externa **no** son compatibles. El intercambio de tokens está probado contra un sustituto local del endpoint de tokens (la aserción firmada se verifica con la clave pública), **no contra Google**.

## Capacidades
Una consola JSON (se ejecuta en el modo del editor JSON): `{ "from": "users", "where": [["age", ">=", 18]], "orderBy": [["age", "desc"]], "limit": 20, "select": ["name"] }`, `{ "collectionGroup": "posts" }`, `{ "get": "users/alice" }`, `{ "collections": "users/alice" }`, `{ "set": "users/alice", "data": {...} }`, `{ "update": "users/alice", "data": {...} }` (combina; el documento debe existir), `{ "delete": "users/alice" }`. Operadores: `== != < <= > >= in not-in array-contains array-contains-any`. Se permiten comentarios y comas finales.

## Notas de tipos
Valores especiales en `data` y filtros: `{"$timestamp": "ISO"}`, `{"$ref": "users/alice"}`, `{"$bytes": "base64"}`, `{"$geo": [lat, lng]}`, `{"$int": "9007199254740993"}` (un número JSON suelto lo redondea JSON.parse antes de enviarse). Los enteros vuelven exactos; los mapas y arreglos son JSON. Los documentos no tienen esquema: las columnas son la unión de los campos de los documentos devueltos, más `__name__` (la ruta del documento).

## Límites (con honestidad)
- Los resultados no van en streaming: una consulta devuelve como máximo `limit` (o `maxRows`, o 10.000) documentos. Cada documento leído se **factura** en Google Cloud.
- Sin transacciones, escrituras por lotes, listeners, consultas de agregación, búsqueda vectorial, herramientas de reglas de seguridad ni gestión de índices; los errores de índice compuesto del servidor se muestran como errores de sintaxis.
- Eliminar un documento no elimina sus subcolecciones.
- Aún no hay cursores de paginación.

## Modo de solo lectura
En el cliente: en una conexión de solo lectura solo se ejecutan `from`/`collectionGroup`/`get`/`collections` (rechaza todo por defecto; la entrada que no se puede analizar cuenta como escritura). Para una garantía en el servidor usa un rol de IAM solo con acceso de lectura.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d firestore` y luego `pnpm --filter @rizomadb/driver-firestore test` (puerto 18080, proyecto `rizoma-test`; se cambia con `RZ_FIRESTORE_PORT`).
