# ADR 0006 — Análisis de SQL
Estado: **propuesta**; se cierra con benchmark en Fase 3
Candidatos: tokenizador propio ligero (completado y separación de sentencias), tree-sitter WASM por dialecto, `libpg-query` WASM (solo PostgreSQL), `sql-formatter` (MIT) para formateo.
Hipótesis de trabajo: tokenizador propio + separación por dialecto en Fase 1; tree-sitter/libpg-query solo si el benchmark justifica su peso en el VSIX y su latencia.
Criterios: latencia de completado, tamaño de VSIX, cobertura de dialectos, licencia, fuzzing sin fallos.
