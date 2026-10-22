# Amazon DynamoDB

**Nível:** 2 · **Versões testadas:** DynamoDB Local 2.5.2 (testada). O serviço real da AWS usa a mesma API e a mesma assinatura de requisições (verificada com o vetor de teste SigV4 publicado pela AWS), mas **não foi testado com a AWS**, então não está confirmado que funcione ali. Teste-o com um usuário IAM somente leitura ou uma tabela descartável antes de depender dele.

## Autenticação e transporte
Chaves de acesso (ID da chave de acesso, chave de acesso secreta e token de sessão opcional), assinadas com SigV4 sobre HTTPS. As chaves digitadas na conexão prevalecem; caso contrário, o campo **Perfil da AWS** lê um perfil de `~/.aws/credentials` (ou `AWS_SHARED_CREDENTIALS_FILE`; a região vem de `~/.aws/config`); caso contrário, usam-se as variáveis de ambiente `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`. Os perfis que precisam de SSO, assunção de função (`role_arn`) ou um programa auxiliar (`credential_process`) são recusados com uma mensagem: exporte chaves temporárias e cole-as no campo do token de sessão. O suporte a perfis é testado contra um endpoint local que registra como as requisições são assinadas, **não contra a AWS**. Defina host/porta/TLS do endpoint para o DynamoDB Local ou um endpoint de VPC.

## Capacidades
Editor PartiQL (roda no modo do editor SQL): `SELECT`/`INSERT`/`UPDATE`/`DELETE`, parâmetros posicionais `?`, índices secundários globais (`FROM "tabela"."índice"`), paginação automática, tabelas/chaves/índices no explorador. Não editável na grade.

## Notas sobre tipos
Os números são exatos (os inteiros além de 2^53 são `bigint`; decimais não representáveis continuam como texto). Listas, mapas e conjuntos são mostrados como JSON. Os itens não têm esquema: as colunas vêm da primeira página; os atributos vistos pela primeira vez depois não são mostrados (uma mensagem avisa).

## Limites (com honestidade)
- Um `SELECT` sem condição de chave é um **scan** completo da tabela que consome capacidade de leitura; o classificador de risco o assinala, mas não o bloqueia.
- Sem transações, sem `CreateTable`/DDL (isso não é PartiQL), sem streams, sem ferramentas de PITR/backup.
- A limitação de taxa é relatada como erro de tempo limite; não há nova tentativa/backoff automático.

## Imposição do somente leitura
No cliente: só `SELECT`/`EXISTS` executam em uma conexão somente leitura (nega por padrão). Para uma garantia no servidor, use uma política IAM limitada a ações de leitura.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http e node:crypto)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d dynamodb` e depois `pnpm --filter @rizomadb/driver-dynamodb test` (porta 18000, substitua com `RZ_DYNAMODB_PORT`).
