# Contribuir

[English](CONTRIBUTING.md) · Español · [Português (Brasil)](CONTRIBUTING.pt-br.md) · [Français](CONTRIBUTING.fr.md)

1. `pnpm install`. Levanta los motores que necesites para las pruebas: `docker compose -f test/compose/docker-compose.yml up -d <motor>`.
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` debe pasar. Las suites de motores se omiten cuando su motor está apagado en local y fallan en el CI. Para la extensión ejecuta también `pnpm --filter rizomadb test:e2e` (un VS Code real).
3. Ramas: trabaja en una rama y abre un pull request hacia **`dev`**; `dev` se promueve a **`main`** con un pull request (lo abre el workflow *Promote dev to main*). Mira [docs/es/ci-cd.md](docs/es/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). Sin telemetría, sin secretos fuera de SecretStorage, sin `TODO` en el código terminado.
5. Todo driver nuevo debe pasar `runConformance` de `@rizomadb/driver-api/conformance`, añadir una página de motor en `docs/engines/` y aparecer en `scripts/gen-reference.mjs`.
6. El texto visible para el usuario pasa por `t()` (host) o por la tabla de textos del webview, con traducciones en `apps/extension/l10n/bundle.l10n.es.json`, `bundle.l10n.pt-br.json` y `bundle.l10n.fr.json` (y `package.nls.*.json` para el texto del manifiesto); una prueba falla si falta alguna.
7. Después de cambiar ajustes o comandos ejecuta `node scripts/gen-reference.mjs` para refrescar las páginas de referencia (el CI comprueba que estén al día).
8. La documentación existe en inglés, español, portugués (Brasil) y francés. Cuando cambies una página de `docs/`, actualiza sus equivalentes en `docs/es/`, `docs/pt-br/` y `docs/fr/` (o di en el pull request cuáles faltan). `node scripts/check-docs-parity.mjs` lista las páginas que faltan.
9. Decisiones técnicas importantes: añade un ADR en `docs/adr/`.

Licencia de las contribuciones: Apache-2.0.

Agentes de IA: lee primero [AGENTS.md](AGENTS.md) (en inglés); el trabajo de interfaz sigue la [guía de diseño](docs/design/design-guide.md) (en inglés). `graphify-out/GRAPH_REPORT.md` es un mapa del código.

## Revisar una traducción
Los textos en portugués (Brasil) y francés se escribieron con ayuda de IA y esperan la revisión de hablantes nativos. `node scripts/export-translations.mjs` escribe `translation-review/pt-br.csv` y `fr.csv` (inglés, texto actual y una columna «corrected» vacía; los marcadores como `{0}` deben conservarse). Envía las correcciones como un pull request que edite `apps/extension/l10n/bundle.l10n.<idioma>.json` y `apps/extension/package.nls.<idioma>.json`, o como el CSV rellenado en un issue. Las páginas de documentación de `docs/pt-br/` y `docs/fr/` se pueden corregir igual, directamente en el Markdown.
