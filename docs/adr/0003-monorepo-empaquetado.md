# ADR 0003 — Monorepo y empaquetado
Estado: aceptada (2026-10-20)
- pnpm workspaces + Turborepo. Alternativa Nx: más pesado, sin necesidad hoy. Fijar `packageManager` en package.json (Corepack).
- esbuild para extensión y workers (rápido, salida CJS para el host); Vite para webviews (bundles ESM, CSP sin eval).
- Drivers como paquetes independientes cargados de forma perezosa (`import()` al conectar) para el presupuesto de activación <200 ms.
- Node de build: LTS vigente (v24.22 "Krypton" hoy; VS Code main usa Node 24.18.0 por `.nvmrc`). CI fija v24.
Consecuencia: el Node del host de extensiones lo dicta VS Code, no el nuestro; el código debe correr en el Node embebido de la versión mínima soportada.
