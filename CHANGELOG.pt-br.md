# Registro de alterações

[English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · Português (Brasil) · [Français](CHANGELOG.fr.md)

As alterações relevantes estão listadas aqui, da mais nova para a mais antiga. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/). Nada foi publicado ainda; o diário do dia a dia está em [docs/ai/STATE.md](docs/ai/STATE.md) (em espanhol).

## [Não publicado] — 0.0.1 (não publicado)

### Adicionado
- Um cliente de banco de dados multimotor para VS Code com 24 motores, um editor SQL nativo com botões Executar, uma grade de resultados editável com alterações pendentes aplicadas em uma transação, um designer de tabelas, diagramas ER, importação/exportação e ferramentas de esquema.
- Governança: políticas em camadas em que a mais restritiva vence, um único ponto de política e auditoria para toda escrita, mascaramento de colunas, catálogos compartilhados sem segredos e arquivos de catálogo criptografados.
- Paginação opcional de tabelas por chave primária (SQLite, PostgreSQL, MySQL, SQL Server, Oracle), edição de entradas de streams do Redis, perfis da AWS para o DynamoDB e arquivos de credenciais do Google para o Firestore.
- Um construtor de consultas sem SQL, um gerador de usuários somente leitura, favoritos no histórico e exportação/importação de configurações.
- Pacotes por plataforma que incluem a biblioteca nativa do DuckDB, e etapas de release para somas de verificação, um SBOM e procedência de build (ainda não executadas).
- Interface e documentação em inglês, espanhol, português (Brasil) e francês.

### Corrigido
- Abandonar um resultado grande não bloqueia mais a próxima instrução no MySQL e no SQL Server; um cancelamento tardio não atinge mais a próxima instrução no MySQL, PostgreSQL e Oracle.
- Vários problemas de mascaramento, de restrições padrão do SQL Server e de cancelamento no HydraDB encontrados ao testar com servidores reais.

### Não confirmado
- Contas reais na nuvem (AWS, Google Cloud, MongoDB Atlas, serviços gerenciados de PostgreSQL/MySQL) nunca foram testadas. Redshift, Snowflake e BigQuery não estão implementados. Veja [docs/release/v1-checklist.md](docs/release/v1-checklist.md) (em espanhol).
