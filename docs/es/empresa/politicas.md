<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Políticas

RizomaDB combina capas de políticas y **siempre gana el resultado más estricto**: un archivo de proyecto puede endurecer lo que fijó el equipo, un archivo de usuario puede endurecer lo que fijó el proyecto, y nadie puede relajar lo que una capa superior restringió.

| Capa | Dónde | Cuándo se carga |
|---|---|---|
| Integrada | la extensión | siempre (`rizomadb.security.prodReadOnlyByDefault` solo puede desactivar el valor de solo lectura de `prod` de esta capa) |
| Equipo | ajuste de VS Code `rizomadb.policy.team` (despliégalo como ajuste gestionado o de máquina) | siempre |
| Proyecto | `.rizomadb/policy.json` en cada carpeta del espacio de trabajo | **solo espacios de trabajo de confianza** |
| Usuario | `policy.json` en el almacenamiento global de la extensión | siempre |

Si un archivo de política no se puede leer o validar, todo queda en solo lectura hasta que se corrija (falla cerrado) y el error aparece en el canal de salida *RizomaDB policy*.

## Entornos personalizados
Además de `dev`, `staging` y `prod`, cualquiera puede añadir entornos en el formulario de conexión (**Nuevo entorno…**) o en el ajuste `rizomadb.environments`: `{ "name": "qa", "protection": "confirm" }`, donde la protección es `none`, `confirm` (preguntar antes de cada escritura) o `readOnly` (bloquear las escrituras). Estos entornos forman una capa de política adicional, así que solo pueden añadir rigor; la sección `environments` de un archivo de política (abajo) puede describir el mismo nombre con más detalle y gana el resultado más estricto.

## Formato (`version: 1`)
```json
{
  "version": 1,
  "defaults": { "maxRows": 100000 },
  "environments": {
    "prod": { "readOnly": true, "requireApproval": true, "timeoutSeconds": 30, "maxRows": 10000 },
    "staging": { "deny": ["drop", "truncate"], "confirmWrites": true },
    "qa": { "allow": ["select", "insert", "update"] }
  },
  "disable": ["ai", "backup", "restore"],
  "maskColumns": [{ "column": "/email|phone/i", "rule": "redact" }, { "column": "ssn", "rule": "last4" }]
}
```
* `readOnly` bloquea toda escritura. `allow` (intersección entre capas) y `deny` (unión) restringen los tipos de sentencia: `select insert update delete merge create alter drop truncate grant revoke execute`.
* `requireApproval`: la persona debe escribir el nombre de la conexión antes de que se ejecute cualquier cambio.
* `confirmDestructive`, `confirmWrites`: preguntar antes de las sentencias destructivas o de todas las escrituras. Una preferencia de usuario puede desactivar el aviso rutinario de sentencias destructivas, pero nunca una confirmación que exija la política.
* `maxRows`, `timeoutSeconds`: el valor más pequeño entre las capas se aplica a toda consulta.
* `disable`: desactiva comandos para todos (`ai`, `export`, `import`, `backup`, `restore`, `dataSync`, `designer`, `admin`).
* `maskColumns`: nombres o `/regex/`; reglas `redact`, `nullify`, `hash`, `last4`. Los resultados enmascarados se muestran enmascarados, no se pueden editar en la rejilla y se exportan enmascarados.

## Qué se garantiza y cómo
Todas las conexiones que se entregan a las funciones van envueltas en una **conexión protegida** (`packages/core/src/guard.ts`): una comprobación de política y una entrada de auditoría por sentencia, tanto para el editor como para la rejilla, las importaciones, las herramientas de esquema, la sincronización de datos, los cuadernos y las herramientas de administración. `packages/data-tools/src/policy-paths.test.ts` recorre cada una de esas rutas contra una conexión `prod` y comprueba que los datos no cambian.

Límites que conviene conocer:
* La clasificación es **estática y rechaza todo por defecto** (`assessStatement`): una sentencia es una lectura solo si empieza con una palabra clave de lectura conocida y no contiene ninguna palabra clave de escritura; todo lo que no reconoce cuenta como escritura. No puede ver efectos secundarios ocultos en funciones (`SELECT nextval(...)`, `SELECT pg_terminate_backend(...)`). Para garantías firmes usa una cuenta de base de datos con privilegios de solo lectura; cuando el motor ofrece un modo de solo lectura en el servidor, RizomaDB también lo activa.
* La política protege contra errores y contra funciones de RizomaDB que se comporten mal. Una persona con sus propias credenciales de base de datos y otro cliente sí puede escribir: no sustituye a los permisos de la base de datos.
