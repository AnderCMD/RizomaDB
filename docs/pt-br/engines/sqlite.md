# SQLite

**Nível:** 1 · **Versões testadas no CI:** SQLite como incluído no runtime do Node (`node:sqlite`)

## Autenticação e transporte
caminho do arquivo

## Capacidades
Tudo, exceto as ferramentas de administração; o ALTER de colunas exige reconstruir a tabela (sinalizado como um passo manual)

## Notas sobre tipos
INTEGER exato (bigint além de 2^53)

## Imposição do somente leitura
`PRAGMA query_only`

## Ferramentas externas
`VACUUM INTO` integrado para backups

## Licença do driver
node:sqlite (sem dependência); NOTA: a disponibilidade dentro do Node embutido do VS Code não foi verificada (veja o ADR 0009)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=sqlite pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
