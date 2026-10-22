# Elasticsearch / OpenSearch

**Nivel:** 2 · **Versiones probadas en CI:** Elasticsearch 8.15, OpenSearch 2.17 (probadas)

## Autenticación y transporte
autenticación básica, clave de API, TLS

## Capacidades
Consola REST con comentarios y comas finales, streaming por scroll, mapeos. No se edita en la rejilla

## Notas de tipos
los campos de _source como columnas; lo anidado como JSON

## Modo de solo lectura
Protección en el cliente (solo endpoints de lectura); usa un rol de solo lectura para una garantía en el servidor

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=elasticsearch pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
