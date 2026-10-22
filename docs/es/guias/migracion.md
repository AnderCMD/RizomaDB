# Migrar a RizomaDB

RizomaDB lee las definiciones de conexión de otras herramientas con **RizomaDB: Importar conexiones**. No se envía nada a ningún lado; los archivos se analizan en local.

| Origen | Qué se importa | Qué NO se importa |
|---|---|---|
| URI de conexión (`postgres://`, `mysql://`, `mongodb://`, `redis://`, ...) | host, puerto, base de datos, usuario, indicador de TLS | — (la contraseña de la URI se ofrece para SecretStorage, nunca se escribe en los ajustes) |
| `~/.pgpass` | host, puerto, base de datos, usuario, contraseña | Se omiten las entradas con comodín (`*`) |
| `~/.my.cnf` | host, puerto, usuario, contraseña | Los grupos de opciones distintos de `client`/`mysql` |
| `data-sources.json` de DBeaver | nombre, driver, host, puerto, base de datos | Nombres de usuario y contraseñas (DBeaver los cifra; introdúcelos en la primera conexión) |
| `settings.json` de SQLTools (`sqltools.connections`) | nombre, driver, host, puerto, base de datos, usuario | Los drivers que RizomaDB no implementa |

Las contraseñas encontradas en texto plano solo se guardan después de que confirmes, y únicamente en VS Code SecretStorage.

## Desde Database Client (cweijan) y DBCode
No hay un formato de importación para ellos: no se verificó cómo guardan las conexiones contra fuentes primarias, así que no lo adivinamos. Usa el importador de URI o recrea las conexiones con el asistente.

## Conceptos que cambian
- **Las ediciones se ponen en cola.** Las ediciones de la rejilla se convierten en un conjunto de cambios pendientes que revisas y aplicas en una sola transacción; no se escribe nada al confirmar una celda (salvo que actives `rizomadb.edit.applyImmediately`).
- **Política.** Las conexiones `prod` son de solo lectura por defecto; cámbialo en el perfil de la conexión o en los archivos de política ([Políticas](../empresa/politicas.md)).
- **Sin telemetría.** No hay nada de lo que desactivarse.
