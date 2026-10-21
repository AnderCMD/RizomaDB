# ADR 0007 — Rejilla de resultados
Estado: **propuesta**; se cierra con benchmark en Fase 1
Base: TanStack Virtual (MIT) con rejilla propia, patrón ARIA `grid`, ventana de datos acotada con streaming desde el worker.
Aceptación: 1 M de filas a 60 fps, memoria acotada por ventana, navegación completa con teclado y lector de pantalla.
Alternativa: usar una librería de grid completa; se descartaría por licencia/accesibilidad si no cumple WCAG 2.2 AA.
