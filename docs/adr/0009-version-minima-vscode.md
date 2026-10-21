# ADR 0009 — Versión mínima de VS Code
Estado: provisional
Hoy: `@types/vscode` 1.140.0 y VS Code main usa Node 24.18.0. Mínimo propuesto: `engines.vscode ^1.100.0`.
Por verificar en Fase 1 (no pude confirmarlo hoy): la versión de Electron/Node de cada release y si `node:sqlite` está disponible en el mínimo; ajustar el mínimo según eso y las API que usemos (notebooks, SecretStorage, l10n).
Compatibilidad con Cursor/Windsurf/VSCodium: probar contra su motor VS Code base.
