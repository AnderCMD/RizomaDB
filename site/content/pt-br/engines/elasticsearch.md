# Elasticsearch / OpenSearch

**Nível:** 2 · **Versões testadas no CI:** Elasticsearch 8.15, OpenSearch 2.17 (testadas)

## Autenticação e transporte
autenticação básica, chave de API, TLS

## Capacidades
Console REST com comentários e vírgulas finais, streaming por scroll, mapeamentos. Não editável na grade

## Notas sobre tipos
Campos de _source como colunas; aninhados como JSON

## Imposição do somente leitura
Proteção no cliente (somente endpoints de leitura); use um papel somente leitura para uma garantia no servidor

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=elasticsearch pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
