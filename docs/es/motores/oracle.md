# Oracle Database

**Nivel:** 1 · **Versiones probadas en CI:** Oracle Free 23ai (probada); se espera 12c+

## Autenticación y transporte
usuario/contraseña en modo thin (no hace falta Oracle Client); wallet/Kerberos NO están implementados

## Capacidades
Igual que PostgreSQL; EXPLAIN mediante PLAN_TABLE

## Notas de tipos
NUMBER se lee como texto y se convierte (exacto); CLOB como texto

## Modo de solo lectura
Sin modo de solo lectura de sesión: protección de sentencias en el cliente. `DBMS_SESSION.SLEEP` no se puede interrumpir con la cancelación; las consultas que consumen CPU sí

## Herramientas externas
ninguna (Data Pump necesita herramientas del fabricante)

## Licencia del driver
oracledb thin (Apache-2.0 OR UPL-1.0)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=oracle pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
