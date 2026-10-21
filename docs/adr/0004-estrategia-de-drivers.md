# ADR 0004 — Drivers: JS/WASM antes que nativos
Estado: aceptada (2026-10-20)
- Preferir JS puro (`pg`, `mysql2`, `tedious`, `oracledb` thin, `mongodb`, `ioredis`; licencias MIT/Apache verificadas hoy, oracledb Apache-2.0 OR UPL-1.0).
- SQLite: decidir en Fase 1 entre `node:sqlite` (si el Node embebido de la versión mínima de VS Code lo ofrece) y sqlite WASM. Criterio: ambos deben pasar el kit de conformidad y el benchmark.
- Binarios nativos solo si inevitables: VSIX por plataforma (`vsce --target`).
- Herramientas externas (pg_dump, etc.): detectadas e invocadas, nunca empaquetadas.
- Cada driver: auditoría de licencia en `docs/legal/third-party-licenses.md`, generada por CI.
