<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Tratamiento de datos y notas de cumplimiento

## Qué toca y qué guarda RizomaDB
| Dato | Dónde | Notas |
|---|---|---|
| Contraseñas, tokens, frases de paso de SSH | solo VS Code SecretStorage | nunca en ajustes, historial, registros ni catálogos |
| Perfiles de conexión | estado global de VS Code | sin secretos |
| Historial de consultas | `history.jsonl` en el almacenamiento de la extensión | SQL con `password=…` redactado; retención `rizomadb.history.retentionDays` |
| Registro de auditoría | JSONL local | literales eliminados por defecto |
| Resultados de consultas | solo en memoria (rejilla) | tope de filas `rizomadb.query.maxRows`; las exportaciones van donde la persona las guarda |
| Hosts conocidos de SSH | almacenamiento de la extensión + `~/.ssh/known_hosts` | los hosts desconocidos nunca se confían automáticamente |

No se envía ningún dato al proyecto ni a terceros. El asistente de IA opcional está **desactivado por defecto** (`rizomadb.ai.enabled`); si lo activas, una petición va solo al endpoint que configures (un modelo local como Ollama, o el proveedor que elijas), solo después de que confirmes qué se enviará, y los literales pueden redactarse antes (`rizomadb.ai.redactLiterals`). No se envía nada sin esa confirmación, y `disable: ["ai"]` en una política desactiva la función para todos.

## Matriz de controles
| Control | Implementado por | Evidencia |
|---|---|---|
| Acceso (mínimo privilegio) | conexiones de solo lectura, `prod` en solo lectura por defecto, solo lectura en el servidor por motor cuando existe | `policy-paths.test.ts`, pruebas de solo lectura de la conformidad de los drivers |
| Control de cambios | cola de edición con el SQL exacto, aplicación transaccional, aprobaciones, confirmaciones | `editing.test.ts` en 5 motores |
| Registro | auditoría local, incluidos los intentos bloqueados | `policy-engine.test.ts` |
| Minimización de datos | enmascarado en rejilla y exportaciones, auditoría sin literales | pruebas de exportación y enmascarado |
| Seguridad en tránsito | verificación TLS activada por defecto, fijación de la huella de host SSH | pruebas de `network` |
| Cadena de suministro | lockfile, auditoría de licencias, SBOM CycloneDX, procedencia, gitleaks, CodeQL (todo se ejecuta en cada push en el flujo de CI) | `.github/workflows` |

Esta matriz describe el software, no el cumplimiento de una organización: sigues necesitando tu propia evaluación de riesgos.
