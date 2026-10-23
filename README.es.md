<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**Todas tus bases de datos, un solo lugar. Gratis.**

[![License](https://img.shields.io/github/license/AnderCMD/RizomaDB)](LICENSE)

[English](README.md) · Español

Un cliente de bases de datos multimotor para VS Code (y VSCodium, Cursor, Windsurf): Apache-2.0, sin telemetría, sin cuentas, sin funciones bloqueadas. [Sitio de documentación](https://andercmd.github.io/RizomaDB/es/)

> **Estado: 1.1.0.** Disponible en el [Marketplace de VS Code](https://marketplace.visualstudio.com/items?itemName=AnderCMD.rizomadb) y como VSIX adjunto a cada [release de GitHub](https://github.com/AnderCMD/RizomaDB/releases) (Open VSX aún no está publicado). Compila, se instala y pasa sus pruebas contra motores reales, y el responsable del proyecto hizo una revisión manual con lector de pantalla en macOS, Windows y Linux sin encontrar problemas. Algunas cosas **no están confirmadas**, sobre todo las cuentas reales en la nube: mira la [lista de aceptación](docs/es/release/lista-de-aceptacion-v1.md), que es honesta.

## Qué hace
- **Conecta** con 25 motores desde una pantalla de logos, con el host, puerto y usuario habituales ya rellenados (o pega una URL JDBC); entornos (`dev`, `staging`, `prod` o los tuyos) con protección; túneles SSH y proxies HTTP/SOCKS5; secretos solo en el almacén de secretos de VS Code. Las conexiones se agrupan por tipo en el árbol, con la activa y su base de datos en la barra de estado.
- **Consulta** en el lenguaje de cada motor, con un botón Ejecutar sobre cada sentencia, Ejecutar todo, Explicar, parámetros, una pantalla de historial con buscador y notebooks.
- **Explora y edita** en una rejilla hecha para ello: ordenar, filtrar (en las filas o en la base de datos), cambiar anchos, ocultar, panel de registro, copiar/guardar como CSV/TSV/JSON/Markdown, paginación con *Cargar más*, una línea de consulta editable y **edición de celdas en el sitio** con cambios pendientes que revisas y aplicas en una transacción. Renombra, cambia el tipo o elimina una columna desde su menú.
- **Diseña y mueve datos**: diseñador de tablas, diagramas ER, comparación y documentación de esquemas, importar/exportar, copia y restauración, comparación y sincronización de datos y generación de datos de prueba.
- **Gobierna**: políticas en capas donde gana la más estricta, un único punto de política y auditoría para toda escritura, enmascarado de columnas, catálogos compartidos sin secretos.
- **Extras opcionales**: un asistente de IA (apagado por defecto, solo con el esquema) y un servidor MCP de solo lectura con restricciones.
- **Español e inglés**, intercambiables dentro de la extensión, y una **guía** interactiva que te lleva de la mano.

## Motores
Probados contra servidores reales: PostgreSQL (y CockroachDB, YugabyteDB), MySQL/MariaDB (y TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 y 3, Cassandra/ScyllaDB, Firestore (emulador), Trino y **HydraDB (experimental)**. Lo que admite cada uno está en la [matriz de capacidades](docs/es/referencia/matriz-de-motores.md); los límites están en la página de cada motor en [docs/es/motores](docs/es/motores/README.md). **Sin confirmar:** nunca se han probado cuentas reales en la nube (AWS, Google Cloud, MongoDB Atlas ni servicios gestionados de PostgreSQL/MySQL); pruébalos con un usuario de solo lectura o una base de datos desechable antes de depender de ellos. Redshift, Snowflake y BigQuery no están implementados. Ver [Nube y servicios gestionados](docs/es/motores/README.md#nube-y-servicios-gestionados-sin-confirmar).

## Instalar
Instala **RizomaDB** desde el Marketplace de VS Code (busca «RizomaDB», o ejecuta `code --install-extension AnderCMD.rizomadb`), o descarga el `.vsix` del último [release](https://github.com/AnderCMD/RizomaDB/releases) y ejecuta `code --install-extension rizomadb-1.1.0.vsix`. Para construirlo tú:
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-1.1.0.vsix
```
Luego haz clic en el icono de RizomaDB, o ejecuta **RizomaDB: Abrir la guía**. Recorrido completo: [Primeros pasos](docs/es/guias/primeros-pasos.md).

## Documentación
[Primeros pasos](docs/es/guias/primeros-pasos.md) · [Conexiones](docs/es/guias/conexiones.md) · [El editor de consultas](docs/es/guias/editor-de-consultas.md) · [La rejilla de resultados](docs/es/guias/rejilla-de-resultados.md) · [Usar el teclado](docs/es/guias/teclado.md) · [Edición de datos](docs/es/guias/edicion-de-datos.md) · [Idioma y ajustes](docs/es/guias/idioma-y-ajustes.md) · [Solución de problemas](docs/es/guias/solucion-de-problemas.md) · [Ayuda a probar](docs/es/guias/ayuda-a-probar.md) · Referencia de [ajustes](docs/es/referencia/ajustes.md) y de [comandos](docs/es/referencia/comandos.md) · [Políticas](docs/es/empresa/politicas.md) · [Modelo de amenazas](docs/es/seguridad/modelo-de-amenazas.md) · [CI/CD](docs/es/ci-cd.md) · [Guía de diseño](docs/es/design/guia-de-diseno.md) · [AGENTS.md](AGENTS.md) (en inglés) · [Escribir un driver](docs/es/drivers/crear-un-driver.md)

## Desarrollo
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # o el motor que quieras probar
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # regenera las páginas de referencia de ajustes, comandos y motores
```
`dev` es la rama de integración y `main` es lo que se despliega (el sitio de documentación); el CI corre en ambas. Mira [CONTRIBUTING.es.md](CONTRIBUTING.es.md), [docs/es/ci-cd.md](docs/es/ci-cd.md).

## Licencia
Apache-2.0. Licencias de terceros: [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md). [Código de conducta](CODE_OF_CONDUCT.es.md) · [Seguridad](SECURITY.es.md) · [Registro de cambios](CHANGELOG.es.md).
