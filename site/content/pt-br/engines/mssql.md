# SQL Server

**Nível:** 1 · **Versões testadas no CI:** SQL Server 2022 (testada)

## Autenticação e transporte
Login SQL, TLS, túnel SSH (Windows/Kerberos/NTLM e Azure AD NÃO estão implementados)

## Capacidades
Igual ao PostgreSQL; EXPLAIN via SHOWPLAN_ALL

## Notas sobre tipos
BIGINT exato; DECIMAL/NUMERIC chegam como números JS do driver (tedious), então valores além de 2^53 perdem precisão

## Imposição do somente leitura
Não existe um modo somente leitura de sessão: o driver rejeita as instruções que não são de leitura (proteção no cliente)

## Ferramentas externas
nenhuma (o backup nativo exige ferramentas do fabricante)

## Licença do driver
tedious (MIT)

## Tela da tabela (filtro, paginação, menu da coluna)
Verificada contra um servidor real em `apps/extension/src/lib/engines.integration.test.mts`: SQL Server 2022 (filtro, paginação, renomear/tipo/padrão/NOT NULL/adicionar/excluir coluna; um padrão é alterado procurando e substituindo sua restrição gerada).

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=mssql pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
