# SQL Server

**Nivel:** 1 · **Versiones probadas en CI:** SQL Server 2022 (probada)

## Autenticación y transporte
login SQL, TLS, túnel SSH (la autenticación de Windows/Kerberos/NTLM y Azure AD NO están implementadas)

## Capacidades
Igual que PostgreSQL; EXPLAIN mediante SHOWPLAN_ALL

## Notas de tipos
BIGINT exacto; DECIMAL/NUMERIC llegan como números de JS desde el driver (tedious), así que los valores mayores que 2^53 pierden precisión

## Modo de solo lectura
No existe un modo de solo lectura de sesión: el driver rechaza las sentencias que no son lecturas (protección del lado del cliente)

## Herramientas externas
ninguna (la copia de seguridad nativa necesita herramientas del fabricante)

## Licencia del driver
tedious (MIT)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=mssql pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
