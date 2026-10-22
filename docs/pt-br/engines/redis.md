# Redis / Valkey

**Nível:** 1 · **Versões testadas no CI:** Redis 7, Valkey 8 (testadas)

## Autenticação e transporte
senha/usuário ACL, TLS

## Capacidades
Navegador de chaves (SCAN com o cursor gerenciado para você; KEYS é recusado), visualizador por tipo (OPEN), console, TTL/renomear/excluir com confirmação, e **Editar o valor da chave…** para strings (a expiração é mantida), campos de hash, elementos de lista, membros de conjunto (renomeados: o novo membro é adicionado antes de o antigo ser removido), pontuações de conjuntos ordenados (apenas membros existentes) e entradas de streams. As entradas de um stream nunca são alteradas no lugar: **Editar o valor da chave…** em um stream adiciona uma entrada (XADD, com ID automático ou explícito) ou exclui uma (XDEL). Tudo isso é testado contra um Redis real; o texto com aspas, quebras de linha e emoji é preservado. NÃO implementado: MONITOR/Pub-Sub, grupos de consumidores, análise de memória

## Notas sobre tipos
Strings exatas; as respostas inteiras são números JS (além de 2^53 podem perder precisão)

## Imposição do somente leitura
Proteção no cliente a partir de uma tabela estática de comandos; os comandos desconhecidos contam como gravações. Use um usuário ACL com `+@read` para uma garantia no servidor

## Ferramentas externas
nenhuma

## Licença do driver
ioredis (MIT)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=redis pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
