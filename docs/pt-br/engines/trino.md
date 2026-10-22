# Trino

**Nível:** 2 · **Versões testadas:** Trino 470, nó único, catálogo `memory` (testada). Starburst, Athena (baseado no Trino, mas outro serviço), Presto e clusters protegidos (OAuth, Kerberos, certificados de cliente) **não** são testados.

## Autenticação e transporte
Nome de usuário (`X-Trino-User`) sobre HTTP ou HTTPS; senha opcional (HTTP basic, aceita somente sobre TLS). OAuth2, Kerberos, JWT e certificados de cliente **não** são suportados.

## Capacidades
Editor SQL (dialeto ANSI), parâmetros `?` (enviados como instrução `PREPARE` + `EXECUTE ... USING` com literais escapados), streaming de páginas de resultado, seleção de catálogo/esquema, esquemas, tabelas, views e colunas no explorador (de `information_schema` do catálogo configurado), `EXPLAIN` em texto. Não editável na grade.

## Notas sobre tipos
`bigint` continua exato (exige um runtime com acesso à origem em `JSON.parse`: o VS Code 1.100+ atende); `decimal` é texto; arrays, mapas e linhas são JSON; `varbinary` são bytes; datas e timestamps chegam como o texto do servidor.

## Limites (com honestidade)
- Só o catálogo configurado é navegado; as consultas entre catálogos funcionam escrevendo `catálogo.esquema.tabela`.
- O Trino não tem chaves primárias nem estrangeiras: o explorador não mostra nenhuma e as ferramentas de designer/diff de esquema não são suportadas para o Trino.
- Sem transações; sem exibição de progresso da consulta; a consulta é cancelada com `DELETE` na URI da instrução.
- As instruções preparadas são por requisição; uma lista de parâmetros muito grande é enviada como literais.

## Imposição do somente leitura
No cliente: só `SELECT`, `WITH`, `VALUES`, `SHOW`, `DESCRIBE` e `EXPLAIN` (não `EXPLAIN ANALYZE` de uma gravação) passam em uma conexão somente leitura; todo o resto, incluindo entrada com várias instruções, é rejeitado. Para uma garantia no servidor, use as regras de controle de acesso do Trino.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d trino` (cerca de um minuto para iniciar) e depois `pnpm --filter @rizomadb/driver-trino test` (porta 18081; substitua com `RZ_TRINO_PORT`).
