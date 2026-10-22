# MongoDB

**Nível:** 1 · **Versões testadas no CI:** MongoDB 7 (testada)

## Autenticação e transporte
usuário/senha, URI, TLS; Atlas SRV por URI (não testado com o Atlas, então não está confirmado que funcione ali; tente primeiro em somente leitura)

## Capacidades
Coleções como tabelas, fila de edição de documentos com concorrência otimista, analisador de esquema, pré-visualização do pipeline por estágio (texto), criar/remover índice, importação/exportação, mongodump/mongorestore

## Notas sobre tipos
ObjectId como string hexadecimal, Long exato, Decimal128 como string, documentos aninhados como JSON

## Imposição do somente leitura
Proteção no cliente (lista de comandos de leitura permitidos); use um usuário de banco de dados somente leitura para uma garantia no servidor

## Ferramentas externas
`mongodump`, `mongorestore` (MongoDB Database Tools, detectadas)

## Licença do driver
mongodb (Apache-2.0)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d <serviço>` e depois `RZ_ENGINES=mongodb pnpm test` (veja `test/compose/docker-compose.yml` para as portas e `packages/test-engines` para os auxiliares).
