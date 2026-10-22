# CI/CD

Como uma mudança viaja de uma branch até os usuários, e o que é automático.

```
branch de funcionalidade ──PR──▶ dev ──PR (workflow Promote)──▶ main ──▶ site de documentação (GitHub Pages)
                                                                  └──tag v*──▶ workflow Release ──▶ (aprovação manual) marketplaces
```

| Workflow | Roda em | O que faz |
|---|---|---|
| `ci.yml` | push e pull request para `main` ou `dev` | lint, build, typecheck, auditoria de licenças, uma verificação de que as páginas de referência geradas estão em dia, as suítes de testes contra contêineres de motores reais (um segundo job, `engines-extra`, sobe CockroachDB, YugabyteDB, InfluxDB 3, Firestore e HydraDB a partir do arquivo compose), benchmarks, constrói o VSIX e o guarda como artefato (14 dias), constrói o site de documentação, constrói e testa o VSIX de linux-x64 (`platform-package`), procura segredos (gitleaks) e executa o CodeQL. Um push mais novo substitui uma execução em andamento. |
| `pages.yml` | push para `main` que toque `docs/`, `site/` ou o workflow, ou manual | constrói o site VitePress (inglês, espanhol, português e francês) e o implanta no GitHub Pages. |
| `promote.yml` | manual | abre o pull request `dev` → `main` se a dev tiver commits que a main não tem. |
| `release.yml` | tag `v*`, ou manual | constrói o VSIX universal e um VSIX por plataforma (com a biblioteca nativa do DuckDB), verifica seu tamanho, gera o SBOM e as somas de verificação, atesta a procedência e os anexa a uma prerelease. **Publicar no Marketplace e no Open VSX é uma etapa separada que exige aprovação manual.** |

Nada é publicado automaticamente em nenhum marketplace ou registro.

## Configurações do repositório
Estas são configurações do repositório, não código, então os workflows não as aplicam. Aplicadas em 2026-10-22:
- `main` e `dev` estão protegidas: as verificações `test`, `engines-extra`, `site` e `secrets` devem passar, e force-pushes e exclusões são bloqueados. Os administradores não são obrigados a passar por pull requests, então o responsável ainda pode avançar `main` a partir de `dev` com fast-forward.
- O ambiente `marketplace` (usado pelo job de release para publicar) exige um revisor e só aceita branches protegidas.
- O token padrão dos workflows é somente leitura e o Actions não pode aprovar pull requests.

Não ativado: permitir que o GitHub Actions crie pull requests (Settings → Actions → General), o que o `promote.yml` precisa para abrir o pull request `dev` → `main`.

## Equivalentes locais
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, depois `node scripts/gen-reference.mjs --check` (ou sem `--check` para atualizar as páginas de referência), depois `pnpm --filter rizomadb package`. Para o site: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Os motores que precisam de contêineres sobem com `docker compose -f test/compose/docker-compose.yml up -d <motor>`.

## Verificar um pacote de release
Cada VSIX de um release vem com `SHA256SUMS`, um SBOM (`sbom.cdx.json`) e uma atestação de procedência de build do GitHub. Para verificar um download:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
A atestação prova qual execução do workflow construiu o arquivo; não é um certificado de assinatura de código. Este caminho ainda não foi executado, porque nenhum release foi feito.
