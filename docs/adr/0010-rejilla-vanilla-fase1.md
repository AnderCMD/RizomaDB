# ADR 0010 — Rejilla de la Fase 1 en TypeScript sin React
Estado: aceptada (2026-10-20), revisable
Decisión: la rejilla de resultados es TS nativo con virtualización por ventana (51 KB con zod/mini), no React.
Motivo: una sola vista de solo lectura; React añadiría ~140 KB sin beneficio. Se adopta React cuando lleguen formularios y edición (Fase 2).
Carga: las filas viven en la webview acotadas por `rizomadb.query.maxRows` (10 000 por defecto); la paginación por ventana desde el host es trabajo pendiente (ADR 0007).
