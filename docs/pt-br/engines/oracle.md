# Oracle Database

**Nível:** 1 · **Versões testadas no CI:** Oracle Free 23ai (testada); 12c+ esperada

## Autenticação e transporte
usuário/senha em modo thin (não precisa do Oracle Client); wallet/Kerberos NÃO estão implementados

## Capacidades
Igual ao PostgreSQL; EXPLAIN via PLAN_TABLE

## Notas sobre tipos
NUMBER lido como texto e convertido (exato); CLOB como texto

## Imposição do somente leitura
Não existe um modo somente leitura de sessão: proteção de instruções no cliente. O `DBMS_SESSION.SLEEP` não pode ser interrompido pelo cancelamento; as consultas limitadas pela CPU podem

## Ferramentas externas
nenhuma (o Data Pump exige ferramentas do fabricante)

## Licença do driver
oracledb thin (Apache-2.0 OR UPL-1.0)

## Tela da tabela (filtro, paginação, menu da coluna)
Verificada contra um servidor real em `apps/extension/src/lib/engines.integration.test.mts`: Oracle Free 23ai (filtro, paginação, renomear/tipo/padrão/NOT NULL/adicionar/excluir coluna; os nomes são os em maiúsculas que o Oracle armazena).

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=oracle pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
