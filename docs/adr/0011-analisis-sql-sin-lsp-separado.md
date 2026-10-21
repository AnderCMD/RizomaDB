# ADR 0011 — Análisis de SQL: tokenizador propio en el host, sin proceso LSP (por ahora)
Estado: aceptada (2026-10-20), revisable en Fase 10

Decisión: `@rizomadb/sql` (tokenizador propio, separador por dialecto, contexto de cláusulas, completado, diagnósticos) se ejecuta como biblioteca en el host de extensiones, sobre un `SchemaIndex` inmutable con búsqueda binaria por prefijo.
Medido (`pnpm bench`, 5 000 tablas × 20 columnas): completado p95 ≈ 0.15 ms (presupuesto 100 ms); tokenizar 1 MB ≈ 52 ms.
Por qué no LSP/tree-sitter/libpg-query todavía: la latencia ya cumple con margen de 600×, un proceso LSP añade serialización y complejidad, y tree-sitter/libpg-query suman peso al VSIX. Se reabre si hace falta un análisis sintáctico completo (p. ej. renombrar alias, extraer CTE, errores de sintaxis con posición) o si el análisis bloquea el host con scripts enormes.
Limitaciones conocidas: no hay árbol sintáctico completo; los diagnósticos de sintaxis los da el motor al ejecutar; no hay refactors (renombrar alias, extraer CTE) ni hover/ayuda de firma de funciones.
Cumple la prueba de fuzzing: tokenizador sin pérdida y separador sin excepciones con 3 000+ entradas aleatorias por dialecto.
