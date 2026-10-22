<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**Todos os seus bancos de dados, em um só lugar. Grátis.**

[English](README.md) · [Español](README.es.md) · Português (Brasil) · [Français](README.fr.md)

Um cliente de banco de dados multimotor para o VS Code (e VSCodium, Cursor, Windsurf): Apache-2.0, sem telemetria, sem contas, sem recursos bloqueados. [Site de documentação](https://andercmd.github.io/RizomaDB/pt-br/)

> **Status: pré-lançamento.** Nada foi publicado ainda no Marketplace, no Open VSX nem no npm, e a v1.0 **não** está pronta: veja a [lista de aceitação](docs/release/v1-checklist.md) (em espanhol), que é honesta. A extensão compila, instala e passa nos testes contra motores reais, e o responsável pelo projeto fez uma revisão manual com leitor de tela no macOS, Windows e Linux sem encontrar problemas.

## O que ele faz
- **Conecte** a 24 motores a partir de uma tela de logotipos, com host, porta e usuário habituais já preenchidos; ambientes (`dev`, `staging`, `prod` ou os seus) com proteção; túneis SSH e proxies HTTP/SOCKS5; segredos somente no armazenamento de segredos do VS Code. As conexões são agrupadas por tipo na árvore, com a ativa e seu banco de dados na barra de status.
- **Consulte** na linguagem de cada motor, com um botão Executar acima de cada instrução, Executar tudo, Explicar, parâmetros, uma tela de histórico com busca e notebooks.
- **Explore e edite** em uma grade feita para isso: ordenar, filtrar (nas linhas ou no banco de dados), redimensionar, ocultar, painel de registro, copiar/salvar como CSV/TSV/JSON/Markdown, paginação com *Carregar mais*, uma linha de consulta editável e **edição de células no lugar** com alterações pendentes que você revisa e aplica em uma transação. Renomeie, altere o tipo ou exclua uma coluna pelo menu dela.
- **Projete e mova dados**: designer de tabelas, diagramas ER, comparação e documentação de esquemas, importação/exportação, backup e restauração, comparação e sincronização de dados e geração de dados de teste.
- **Governe**: políticas em camadas em que a mais restritiva vence, um único ponto de política e auditoria para toda escrita, mascaramento de colunas, catálogos compartilhados sem segredos.
- **Extras opcionais**: um assistente de IA (desligado por padrão, somente com o esquema) e um servidor MCP somente leitura com restrições.
- **Inglês, espanhol, português (Brasil) e francês** (os dois últimos com ajuda de IA, ainda sem revisão nativa), alternáveis dentro da extensão, e um **guia** interativo que leva você pela mão.

## Motores
Testados contra servidores reais: PostgreSQL (e CockroachDB, YugabyteDB), MySQL/MariaDB (e TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 e 3, Cassandra/ScyllaDB, Firestore (emulador), Trino e **HydraDB (experimental)**. O que cada um suporta está na [matriz de capacidades](docs/pt-br/reference/engine-matrix.md); os limites estão na página de cada motor em [docs/pt-br/engines](docs/pt-br/engines/README.md). **Não confirmado:** contas reais na nuvem (AWS, Google Cloud, MongoDB Atlas e serviços gerenciados de PostgreSQL/MySQL) nunca foram testadas; teste com um usuário somente leitura ou um banco de dados descartável antes de depender delas. Redshift, Snowflake e BigQuery não estão implementados. Veja [Nuvem e serviços gerenciados](docs/pt-br/engines/README.md#nuvem-e-serviços-gerenciados-não-confirmados).

## Instalar
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```
Depois clique no ícone do RizomaDB ou execute **RizomaDB: Abrir o guia**. Passo a passo completo: [Primeiros passos](docs/pt-br/guides/getting-started.md).

## Documentação
[Primeiros passos](docs/pt-br/guides/getting-started.md) · [Conexões](docs/pt-br/guides/connections.md) · [O editor de consultas](docs/pt-br/guides/query-editor.md) · [A grade de resultados](docs/pt-br/guides/results-grid.md) · [Usar o teclado](docs/pt-br/guides/keyboard.md) · [Edição de dados](docs/pt-br/guides/editing-data.md) · [Idioma e configurações](docs/pt-br/guides/language-and-settings.md) · [Solução de problemas](docs/pt-br/guides/troubleshooting.md) · [Ajude a testar](docs/pt-br/guides/help-test.md) · Referência de [configurações](docs/pt-br/reference/settings.md) e de [comandos](docs/pt-br/reference/commands.md) · [Políticas](docs/pt-br/enterprise/policy.md) · [Modelo de ameaças](docs/pt-br/security/threat-model.md) · [CI/CD](docs/pt-br/ci-cd.md) · [Guia de design](docs/design/design-guide.md) (em inglês) · [AGENTS.md](AGENTS.md) (em inglês) · [Escrever um driver](docs/pt-br/drivers/authoring.md)

## Desenvolvimento
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # ou o motor que você quiser testar
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # regenera as páginas de referência de configurações, comandos e motores
```
`dev` é a branch de integração e `main` é o que é implantado (o site de documentação); o CI roda em ambas. Veja [CONTRIBUTING.pt-br.md](CONTRIBUTING.pt-br.md), [docs/pt-br/ci-cd.md](docs/pt-br/ci-cd.md), os registros de decisão em [docs/adr](docs/adr) e o diário em [docs/ai/STATE.md](docs/ai/STATE.md).

## Licença
Apache-2.0. Licenças de terceiros: [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md). [Código de conduta](CODE_OF_CONDUCT.pt-br.md) · [Segurança](SECURITY.pt-br.md) · [Registro de alterações](CHANGELOG.pt-br.md).
