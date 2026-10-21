# ADR 0008 — Protocolo host⇄webview
Estado: aceptada (2026-10-20)
- Mensajes tipados, con campo `v` de versión de protocolo y `id` de correlación.
- Validación en ejecución con zod en ambos extremos; mensajes que no validan se descartan y registran (sin datos sensibles).
- CSP estricta (sin `eval`, sin remotos), `localResourceRoots` mínimos, nonce por carga.
- Los resultados grandes no viajan en un solo mensaje: ventanas paginadas bajo demanda.
