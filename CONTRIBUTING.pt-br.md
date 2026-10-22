# Contribuir

[English](CONTRIBUTING.md) · [Español](CONTRIBUTING.es.md) · Português (Brasil) · [Français](CONTRIBUTING.fr.md)

1. `pnpm install`. Suba os motores de que precisar para os testes: `docker compose -f test/compose/docker-compose.yml up -d <motor>`.
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` deve passar. As suítes dos motores são ignoradas quando o motor está desligado localmente e falham no CI. Para a extensão, execute também `pnpm --filter rizomadb test:e2e` (um VS Code real).
3. Branches: trabalhe em uma branch e abra um pull request para **`dev`**; `dev` é promovida para **`main`** com um pull request (o workflow *Promote dev to main* o abre). Veja [docs/pt-br/ci-cd.md](docs/pt-br/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). Sem telemetria, sem segredos fora do SecretStorage, sem `TODO` em código finalizado.
5. Todo driver novo deve passar em `runConformance` de `@rizomadb/driver-api/conformance`, adicionar uma página de motor em `docs/engines/` e aparecer em `scripts/gen-reference.mjs`.
6. O texto visível ao usuário passa por `t()` (host) ou pela tabela de textos do webview, com traduções em `apps/extension/l10n/bundle.l10n.es.json`, `bundle.l10n.pt-br.json` e `bundle.l10n.fr.json` (e `package.nls.*.json` para o texto do manifesto); um teste falha quando falta alguma.
7. Depois de alterar configurações ou comandos, execute `node scripts/gen-reference.mjs` para atualizar as páginas de referência (o CI verifica se estão em dia).
8. A documentação existe em inglês, espanhol, português (Brasil) e francês. Ao alterar uma página de `docs/`, atualize as equivalentes em `docs/es/`, `docs/pt-br/` e `docs/fr/` (ou diga no pull request quais ainda faltam). `node scripts/check-docs-parity.mjs` lista as páginas que faltam.
9. Decisões técnicas importantes: adicione um ADR em `docs/adr/`.

Licença das contribuições: Apache-2.0.

Agentes de IA: leia primeiro [AGENTS.md](AGENTS.md) (em inglês); o trabalho de interface segue o [guia de design](docs/design/design-guide.md) (em inglês). `graphify-out/GRAPH_REPORT.md` é um mapa do código.

## Revisar uma tradução
Os textos em português (Brasil) e francês foram escritos com ajuda de IA e aguardam revisão de falantes nativos. `node scripts/export-translations.mjs` gera `translation-review/pt-br.csv` e `fr.csv` (inglês, texto atual e uma coluna «corrected» vazia; marcadores como `{0}` devem ser mantidos). Envie as correções como um pull request que edite `apps/extension/l10n/bundle.l10n.<idioma>.json` e `apps/extension/package.nls.<idioma>.json`, ou como o CSV preenchido em um issue. As páginas de documentação em `docs/pt-br/` e `docs/fr/` podem ser corrigidas da mesma forma, diretamente no Markdown.
