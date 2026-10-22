# MongoDB

**Nivel:** 1 · **Versiones probadas en CI:** MongoDB 7 (probada)

## Autenticación y transporte
usuario/contraseña, URI, TLS; Atlas SRV mediante URI (sin probar contra Atlas, así que no está confirmado que funcione ahí; pruébalo primero en solo lectura)

## Capacidades
Colecciones como tablas, cola de edición de documentos con concurrencia optimista, analizador de esquema, vista previa por etapa de pipelines (texto), crear/eliminar índices, importar/exportar, mongodump/mongorestore

## Notas de tipos
ObjectId como texto hexadecimal, Long exacto, Decimal128 como texto, documentos anidados como JSON

## Modo de solo lectura
Protección en el cliente (lista de comandos de lectura permitidos); usa un usuario de base de datos de solo lectura para una garantía en el servidor

## Herramientas externas
`mongodump`, `mongorestore` (MongoDB Database Tools, se detectan)

## Licencia del driver
mongodb (Apache-2.0)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=mongodb pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
