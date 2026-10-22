<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-dark.svg">
    <img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="320">
  </picture>
</p>

# Contribuir

[English](CONTRIBUTING.md) · Español

1. `pnpm install`. Levanta los motores que necesites para las pruebas: `docker compose -f test/compose/docker-compose.yml up -d <motor>`.
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` debe pasar. Las suites de motores se omiten cuando su motor está apagado en local y fallan en el CI. Para la extensión ejecuta también `pnpm --filter rizomadb test:e2e` (un VS Code real).
3. Ramas: trabaja en una rama y abre un pull request hacia **`dev`**; `dev` se promueve a **`main`** con un pull request (lo abre el workflow *Promote dev to main*). Mira [docs/es/ci-cd.md](docs/es/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). Sin telemetría, sin secretos fuera de SecretStorage, sin `TODO` en el código terminado.
5. Todo driver nuevo debe pasar `runConformance` de `@rizomadb/driver-api/conformance`, añadir una página de motor en `docs/engines/` y aparecer en `scripts/gen-reference.mjs`.
6. El texto visible para el usuario pasa por `t()` (host) o por la tabla de textos del webview, con la traducción al español en `apps/extension/l10n/bundle.l10n.es.json` (y `package.nls.es.json` para el texto del manifiesto); una prueba falla si falta alguna.
7. Después de cambiar ajustes o comandos ejecuta `node scripts/gen-reference.mjs` para refrescar las páginas de referencia (el CI comprueba que estén al día).
8. La documentación existe en inglés y español. Cuando cambies una página de `docs/`, actualiza su equivalente en `docs/es/` (o di en el pull request que aún falta). `node scripts/check-docs-parity.mjs` lista las páginas que faltan.

Licencia de las contribuciones: Apache-2.0.

Agentes de IA: lee primero [AGENTS.md](AGENTS.md) (en inglés); el trabajo de interfaz sigue la [guía de diseño](docs/es/design/guia-de-diseno.md). `graphify-out/GRAPH_REPORT.md` es un mapa del código.
