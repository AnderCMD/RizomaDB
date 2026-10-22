# Comparação honesta

Baseada em `competitive-analysis.md` (verificado em 2026-10-20, escrito em espanhol) e no que o RizomaDB de fato passa nos próprios testes. «Não verificado» significa que não confirmamos em uma fonte primária. Atualizada em 2026-10-22.

| | RizomaDB (este repositório) | DBCode | Database Client | SQLTools |
|---|---|---|---|---|
| Licença | Apache-2.0, todo o código aberto | Produto proprietário | As versões novas são fechadas | MIT |
| Planos pagos | Nenhum | Pro/Team | Não verificado | Nenhum |
| Telemetria | Nenhuma; garantida por um teste de zero sockets | Anônima (segue a configuração do VS Code) | Anônima, com sua própria opção de desativar | Não encontrada |
| Maturidade | Pré-1.0, nunca publicado, sem testes de usuários reais | Muito usado | Muito usado | Muito usado |
| Motores com testes contra um motor real | 18 drivers que cobrem 24 motores: SQLite, PostgreSQL (+CockroachDB, YugabyteDB), MySQL/MariaDB (+TiDB), SQL Server, Oracle, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB Local, InfluxDB 2 e 3, Cassandra/ScyllaDB, emulador do Firestore, Trino, HydraDB (experimental) | «90+» segundo a listagem deles | Veja a listagem | Muitos por meio de drivers |

## Onde o RizomaDB não é (ainda) competitivo
- **Abrangência**: menos motores que a listagem do DBCode; contas reais na nuvem (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gerenciados) nunca foram testadas; Redshift, Snowflake e BigQuery não estão implementados; os motores de Nível 3 e uma ponte JDBC/ODBC não existem.
- **Pouco teste humano até agora**: o teste automático de ponta a ponta o ativa em um VS Code real e verifica os comandos e as lentes do editor, as telas passam no axe em claro e escuro, e o responsável fez uma revisão manual com leitor de tela no macOS, Windows e Linux sem encontrar problemas; não há uma auditoria de acessibilidade independente.
- **Não publicado**: sem listagem no Marketplace nem no Open VSX, e o workflow de release (somas de verificação, SBOM, procedência de build) nunca foi executado.
- **DuckDB** precisa de um módulo nativo específico da plataforma: ele só vem nos arquivos VSIX por plataforma, construídos pelo workflow de release (só dois dos seis foram executados).
- Comunidade: nenhuma ainda. Os textos em português e francês foram escritos com ajuda de IA e não foram revisados por falantes nativos.
- Alguns recursos são jovens: o HydraDB é experimental; a paginação funciona em todos os motores executando a consulta de novo e pulando linhas, o que é mais lento em páginas muito profundas do que um cursor nativo (uma configuração opcional pagina pela chave primária em cinco motores SQL).

## Onde ele difere por projeto
Licença verificável e zero telemetria; um único ponto de política e auditoria para todo caminho de escrita; controles empresariais (política em camadas, ambientes próprios com proteção, mascaramento, auditoria) sem um plano pago; edição no lugar com alterações pendentes aplicadas em uma transação e detecção de conflitos; um assistente de IA opcional somente com o esquema e um servidor MCP opcional somente leitura com restrições; e um guia interativo mais uma interface em inglês, espanhol, português (Brasil) e francês, alternáveis dentro da extensão.
