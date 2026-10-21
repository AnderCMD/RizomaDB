# Análisis competitivo (Fase 0) — verificado 2026-10-20

Datos de Marketplace API y repos oficiales (instalaciones y fechas a hoy). Texto resumido con palabras propias.

| Herramienta | Motores | Licencia | Precio | Telemetría | Instalaciones | Notas |
|---|---|---|---|---|---|---|
| DBCode | "90+" (según su ficha) | Repo `dbcodeio/public` sin licencia declarada (NOASSERTION); producto propietario | Núcleo gratis (incluye edición de datos, notebooks, ER, solo lectura, MCP). Pro: IA, herramientas de datos, sync/compartir, integraciones cloud. Team: control por roles | Anónima si la telemetría de VS Code está activa | ~225 k | Competidor más fuerte; ya no es "limitado" en lo básico |
| Database Client (cweijan) | MySQL/MariaDB, PostgreSQL, SQLite, Redis, ClickHouse, DM, Elasticsearch, SSH | Repo público MIT pero **solo código antiguo; la versión nueva es cerrada** (README del repo) | **No verificado**: no encontré el límite de conexiones en fuentes primarias | **Sí**, anónima, sigue ajustes de VS Code y tiene opt-out propio | ~1.34 M | Inactividad del repo público desde 2026-06 |
| SQLTools | Muchos, vía drivers | MIT | Gratis | No encontré referencia en package.json | ~7.1 M | Activo; sin edición de datos en rejilla (según DBCode, no verificado de forma independiente) |
| MSSQL (Microsoft) | SQL Server / Azure SQL / Fabric | Licencia de Microsoft (repo NOASSERTION) | Gratis | No evaluado | ~9.9 M | Un motor; sucesor oficial de Azure Data Studio (retirado 2026-02-28) |
| MongoDB for VS Code | MongoDB | Apache-2.0 | Gratis | No evaluado | ~3.2 M | Un motor |
| DBeaver CE | Muy amplio | Apache-2.0 | Gratis | No evaluado | n/a (escritorio) | Fuera del editor |
| DbGate | Amplio | GPL-3.0 | Gratis (ver planes) | No evaluado | n/a | GPL: no reutilizable bajo Apache-2.0 |
| Tabularis | — | Apache-2.0 | — | No evaluado | n/a | Escritorio |
| LibreDB Studio | — | MIT | — | No evaluado | n/a | Web/escritorio |

## Correcciones al panorama del prompt maestro
- "Gratis limitado a pocas conexiones y cobra por la completa": **no confirmado** para Database Client; no lo afirmaremos públicamente.
- DBCode ya ofrece gratis gran parte de lo que el prompt trataba como de pago. El diferenciador real frente a él es: **código abierto verificable, cero telemetría, sin niveles Pro/Team, políticas empresariales gratis**.
- Azure Data Studio: retiro confirmado (fuentes en turno anterior).

## Diferenciadores que se mantienen (defendibles)
Apache-2.0 y auditable; cero telemetría con test de CI; sin niveles de pago; políticas y auditoría locales; operación air-gapped; Open VSX y remotos.
Los demás (multi-motor, cola de cambios, ER) ya existen en DBCode: se compiten en calidad, no en exclusividad.

## Pendiente
Telemetría de SQLTools/MSSQL/MongoDB (revisar sus políticas), límite real de Database Client (probar la extensión).
