# Modelo de amenazas (STRIDE) — borrador inicial

Activos: credenciales de bases de datos, datos consultados, historial y registro de auditoría, integridad de los datos escritos, cadena de suministro.

| Amenaza | Categoría | Control |
|---|---|---|
| Un secreto acaba en ajustes, registros o historial | Divulgación de información | Solo SecretStorage; un redactor central; pruebas |
| Un webview inyecta mensajes | Manipulación / elevación de privilegios | CSP estricta, validación con zod en ambos extremos, localResourceRoots mínimos |
| SQL generado con inyección | Manipulación | Escapado de identificadores y literales, parámetros, fuzzing |
| Un espacio de trabajo no confiable carga conexiones o políticas | Elevación de privilegios | Workspace Trust: modo restringido |
| Escritura accidental en producción | Manipulación | Etiquetas de entorno, solo lectura en servidor y cliente, una cola revisable |
| MITM / TLS desactivado | Suplantación | TLS verificado por defecto, aviso visible, huellas SSH |
| Dependencia comprometida | Manipulación | Lockfile, auditoría, SBOM, procedencia |
| Fuga por IA / MCP | Divulgación de información | Apagado por defecto, solo esquema, confirmación, auditoría |
| Repudio de operaciones | Repudio | Registro de auditoría local en JSONL |
| DoS por resultados enormes | Denegación de servicio | Límites de filas y memoria, streaming, workers |

Este documento se mantiene vivo y se revisa en cada fase.
