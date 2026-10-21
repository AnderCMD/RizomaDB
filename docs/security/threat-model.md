# Modelo de amenazas inicial (STRIDE) — borrador Fase 0

Activos: credenciales de BD, datos consultados, historial/auditoría, integridad de datos escritos, cadena de suministro.

| Amenaza | Categoría | Control previsto |
|---|---|---|
| Secreto en settings/logs/historial | Info disclosure | Solo SecretStorage; redactor central; tests |
| Webview inyecta mensajes | Tampering/EoP | CSP estricta, zod en ambos extremos, localResourceRoots mínimos |
| SQL generado con inyección | Tampering | Escapado de identificadores/literales, parámetros, fuzzing |
| Workspace no confiable carga conexiones/políticas | EoP | Workspace Trust: modo restringido |
| Escritura accidental en prod | Tampering | Etiquetas de entorno, solo lectura servidor+cliente, cola revisable |
| MITM / TLS desactivado | Spoofing | TLS verificado por defecto, aviso visible, huellas SSH |
| Dependencia comprometida | Tampering | Lockfile, auditoría, SBOM, procedencia |
| Fuga por IA/MCP | Info disclosure | Apagado por defecto, solo esquema, confirmación, auditoría |
| Repudio de operaciones | Repudiation | Auditoría local JSONL |
| DoS por resultados enormes | DoS | Límites de filas/memoria, streaming, workers |

Se mantendrá vivo; revisión por fase.
