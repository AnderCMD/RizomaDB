# Despliegue

## Sin conexión / entornos aislados
* La extensión **no hace conexiones de red propias**: sin telemetría, sin comprobación de actualizaciones, sin configuración remota. Una prueba (`apps/extension/src/activation.test.ts`) falla si la activación abre un socket o si el código de la extensión o de core importa módulos de red.
* Instala desde un VSIX (`code --install-extension rizomadb-x.y.z.vsix`) o desde un espejo interno de Open VSX. Verifica `SHA256SUMS` y la atestación de procedencia de la compilación adjunta a cada versión.
* Fija la versión en tu herramienta de gestión; las actualizaciones son explícitas.

## Instalación masiva
* **Intune / GPO / Ansible:** distribuye el VSIX y ejecuta `code --install-extension` por usuario, o usa tu marketplace interno. Entrega `rizomadb.policy.team` y `rizomadb.catalog.teamFile` mediante ajustes gestionados de VS Code (ámbito de máquina).
* **Dev Containers / Codespaces:** añade el id de la extensión a `devcontainer.json`; las conexiones se hacen desde el lado remoto, así que la base de datos debe ser alcanzable desde el contenedor.

## Proxies y certificados internos
* Las conexiones a bases de datos pueden pasar por un túnel SSH (host bastión), un **proxy HTTP CONNECT** o un **proxy SOCKS5**, que se elige por conexión en *Ruta de red* (una conexión usa un túnel *o* un proxy). El código de proxies está probado contra servidores proxy falsos locales y, en CI, contra un **Squid 6** real (HTTP CONNECT, con y sin autenticación básica) y un servidor SOCKS5 real (`go-socks5-proxy`, usuario/contraseña) que llegan a un PostgreSQL real. **No** se ha probado contra Dante ni otros productos de proxy, ni contra proxies que exijan NTLM/Kerberos.
* Las llamadas de IA de la propia extensión (desactivadas por defecto) y nada más son el único tráfico que no va a una base de datos que hayas configurado.
* CA internas: PostgreSQL y MySQL aceptan un archivo de CA por conexión (`sslCaFile`); para todo lo demás define `NODE_EXTRA_CA_CERTS` para VS Code. La verificación TLS está activada por defecto y desactivarla muestra un aviso modal.

## Catálogos de conexiones compartidas
`.rizomadb/connections.json` (proyecto) y el archivo indicado por `rizomadb.catalog.teamFile` (equipo) listan conexiones **sin secretos**; a cada persona se le piden los `secretKeys` una sola vez y la respuesta queda en su propio VS Code SecretStorage. Las entradas con secretos en texto plano se rechazan. Las capas posteriores sustituyen a las anteriores por `id`. Las entradas del catálogo no se pueden editar ni eliminar desde la interfaz.
```json
{ "version": 1, "connections": [ { "id": "orders-stg", "name": "Orders (staging)", "driver": "postgres", "environment": "staging", "options": { "host": "orders.stg.internal", "port": 5432, "database": "orders", "user": "app", "ssl": true }, "secretKeys": ["password"] } ] }
```
`${env:VAR}` y `${workspaceFolder}` se expanden en los valores de las opciones.

## Confianza del espacio de trabajo
En un espacio de trabajo sin confianza no se cargan la política del proyecto, el catálogo del proyecto ni los archivos de `.rizomadb`; las capas de usuario y de equipo siguen aplicándose.
