# ADR 0002 — Stack, monorepo y versiones de referencia

Estado: aceptada (2026-10-20)

Versiones consultadas en npm hoy: typescript 7.0.2, turbo 2.11.10, vitest 5.0.5, @vscode/vsce 4.0.0, @vscode/test-electron 3.1.0, @vscode/l10n 0.0.18, @types/vscode 1.140.0; entorno local Node v26.11.1, pnpm 12.6.0.
Drivers (licencia): pg 8.23.1 MIT, mysql2 3.24.6 MIT, tedious 20.3.8 MIT, oracledb 26.0.0 (Apache-2.0 OR UPL-1.0), mongodb 7.7.0 Apache-2.0, ioredis 6.0.0 MIT.

## Decisiones
- pnpm workspaces + Turborepo; TypeScript estricto; esbuild (extensión/workers), Vite (webviews).
- **Versión mínima de VS Code**: `engines.vscode` = `^1.100.0` provisional (≈ 1.140 actual menos margen). A confirmar al crear el paquete contra la versión de Electron/Node que embebe cada release; ADR de seguimiento.
- Node: fijar LTS en CI (comprobar cuál es LTS vigente al iniciar Fase 1; el local v26 puede no ser LTS).
- Editor SQL nativo; LSP en proceso aparte; webviews React sin Webview UI Toolkit.

## Pendientes de ADR propios (con benchmark, Fase 1–3)
Análisis de SQL (tree-sitter vs libpg-query vs tokenizador propio), rejilla (TanStack Virtual), protocolo host⇄webview (zod), drivers nativos vs JS/WASM (SQLite: `node:sqlite` vs WASM según Electron de VS Code).
