# MySQL / MariaDB

**Nível:** 1 · **Versões testadas no CI:** MySQL 8.4 e MariaDB 11 (testadas)

## Autenticação e transporte
usuário/senha, TLS, túnel SSH

## Capacidades
Igual ao PostgreSQL; os bloqueios de administração usam as views do MySQL 8 (a view de bloqueios do MariaDB não está implementada)

## Notas sobre tipos
BIGINT exato, DECIMAL como string, JSON como JSON, BIT/BLOB como bytes

## Imposição do somente leitura
Modo de transação `READ ONLY` da sessão nas conexões somente leitura

## Ferramentas externas
`mysqldump`, `mysql` (detectados no PATH)

## Licença do driver
mysql2 (MIT)

## Tela da tabela (filtro, paginação, menu da coluna)
Verificada contra um servidor real em `apps/extension/src/lib/engines.integration.test.mts`: MySQL 8.4 (filtro, paginação, renomear/tipo/padrão/NOT NULL/adicionar/excluir coluna).

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=mysql pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).

## TiDB
O driver MySQL passa o kit de conformidade completo (15/15) contra o TiDB v8.5.1 (nó único, `pingcap/tidb`, armazenamento unistore; `RZ_TIDB_PORT`, padrão 14000). O TiDB só implementa `SET ... READ ONLY` como uma operação vazia, então, para o TiDB, o driver **não** confia nela: as conexões somente leitura são impostas no driver com uma verificação de instruções que nega por padrão (leituras, `SHOW`, `EXPLAIN`, `WITH ... SELECT`; todo o resto, entrada com várias instruções, `FOR UPDATE` e `INTO OUTFILE` são rejeitados). Essa é uma garantia do lado do cliente; para uma garantia no servidor, use um usuário do TiDB só com permissões SELECT. Não testado: clusters TiKV, TiDB Cloud, TLS, regras de posicionamento, DDL específico do TiDB no designer de esquema.
