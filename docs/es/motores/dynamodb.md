# Amazon DynamoDB

**Nivel:** 2 · **Versiones probadas:** DynamoDB Local 2.5.2 (probada). El servicio real de AWS usa la misma API y la misma firma de peticiones (verificada con el vector de prueba SigV4 publicado por AWS), pero **no se ha probado contra AWS**, así que no está confirmado que funcione ahí. Pruébalo con un usuario de IAM de solo lectura o una tabla desechable antes de depender de él.

## Autenticación y transporte
Claves de acceso (ID de clave de acceso, clave secreta y token de sesión opcional), firmadas con SigV4 sobre HTTPS. Las claves escritas en la conexión mandan; si no, el campo **Perfil de AWS** lee un perfil de `~/.aws/credentials` (o `AWS_SHARED_CREDENTIALS_FILE`; la región sale de `~/.aws/config`); si no, se usan las variables de entorno `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`. Los perfiles que necesitan SSO, asunción de roles (`role_arn`) o un programa auxiliar (`credential_process`) se rechazan con un mensaje: exporta claves temporales y pégalas en el campo del token de sesión. El soporte de perfiles está probado contra un endpoint local que registra cómo se firman las peticiones, **no contra AWS**. Define host/puerto/TLS del endpoint para DynamoDB Local o un endpoint de VPC.

## Capacidades
Editor PartiQL (se ejecuta en el modo del editor SQL): `SELECT`/`INSERT`/`UPDATE`/`DELETE`, parámetros posicionales `?`, índices secundarios globales (`FROM "tabla"."indice"`), paginación automática, tablas/claves/índices en el explorador. No se edita en la rejilla.

## Notas de tipos
Los números son exactos (los enteros mayores que 2^53 son `bigint`; los decimales no representables quedan como texto). Las listas, mapas y conjuntos se muestran como JSON. Los elementos no tienen esquema: las columnas salen de la primera página; los atributos que aparecen más tarde no se muestran (un mensaje lo indica).

## Límites (con honestidad)
- Un `SELECT` sin condición de clave es un **escaneo** completo de la tabla que consume capacidad de lectura; el clasificador de riesgo lo señala pero no lo bloquea.
- Sin transacciones, sin `CreateTable`/DDL (no son PartiQL), sin streams y sin herramientas de PITR/copias.
- La limitación de rendimiento (throttling) se informa como error de tiempo de espera; no hay reintento ni retroceso automáticos.

## Modo de solo lectura
En el cliente: en una conexión de solo lectura solo se ejecutan `SELECT`/`EXISTS` (rechaza todo por defecto). Para una garantía en el servidor usa una política de IAM limitada a acciones de lectura.

## Herramientas externas
ninguna

## Licencia del driver
ninguna (construido sobre node:http y node:crypto)

## Cómo ejecutar las pruebas de integración
`docker compose -f test/compose/docker-compose.yml up -d dynamodb` y luego `pnpm --filter @rizomadb/driver-dynamodb test` (puerto 18000, se cambia con `RZ_DYNAMODB_PORT`).
