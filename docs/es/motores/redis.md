# Redis / Valkey

**Nivel:** 1 · **Versiones probadas en CI:** Redis 7, Valkey 8 (probadas)

## Autenticación y transporte
contraseña/usuario ACL, TLS

## Capacidades
Explorador de claves (SCAN con el cursor gestionado por ti; KEYS se rechaza), visor por tipo (OPEN), consola, TTL/renombrar/eliminar con confirmación, y **Editar el valor de la clave…** para cadenas (se conserva la expiración), campos de hash, elementos de lista, miembros de conjunto (se renombran: primero se añade el nuevo y luego se quita el anterior) y puntuaciones de conjuntos ordenados (solo miembros existentes) (probado contra un Redis real; el texto con comillas, saltos de línea y emoji se conserva). NO implementado: editores de streams, MONITOR/Pub-Sub, análisis de memoria

## Notas de tipos
Las cadenas son exactas; las respuestas enteras son números de JS (más allá de 2^53 pueden perder precisión)

## Modo de solo lectura
Protección en el cliente a partir de una tabla estática de comandos; los comandos desconocidos cuentan como escrituras. Usa un usuario ACL con `+@read` para una garantía en el servidor

## Herramientas externas
ninguna

## Licencia del driver
ioredis (MIT)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d <servicio>` y luego `RZ_ENGINES=redis pnpm test` (los puertos están en `test/compose/docker-compose.yml` y los ayudantes en `packages/test-engines`).
