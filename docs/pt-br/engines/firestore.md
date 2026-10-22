# Google Cloud Firestore

**Nível:** 2 · **Versões testadas:** o emulador do Firestore (imagem `emulators` do Google Cloud CLI, modo Firestore Native, API REST v1) (testada). **O Google Cloud em si não foi testado**, então não está confirmado que funcione ali; as requisições são as mesmas chamadas REST, com um token Bearer. Teste-o com uma conta somente leitura ou um projeto descartável antes de depender dele.

## Autenticação e transporte
Emulador: sem credenciais. Google Cloud: um **token de acesso** OAuth colado na conexão (por exemplo, `gcloud auth print-access-token`; ele expira em cerca de uma hora). Em vez disso, pode-se usar um **arquivo de credenciais do Google** (campo, `GOOGLE_APPLICATION_CREDENTIALS`, ou o arquivo que `gcloud auth application-default login` grava): uma chave de conta de serviço ou um arquivo de usuário autorizado. O RizomaDB então pede por conta própria ao endpoint de tokens do Google (o `token_uri` do arquivo, somente HTTPS) tokens de curta duração e os renova; nada é gravado em disco. Essa é uma requisição que a extensão faz em seu nome, somente quando você se conecta ao Google Cloud. A identidade de carga de trabalho, o servidor de metadados do GCE/Cloud Run e os arquivos de conta externa **não** são suportados. A troca de tokens é testada contra um substituto local do endpoint de tokens (a asserção assinada é verificada com a chave pública), **não contra o Google**.

## Capacidades
Um console JSON (roda no modo do editor JSON): `{ "from": "users", "where": [["age", ">=", 18]], "orderBy": [["age", "desc"]], "limit": 20, "select": ["name"] }`, `{ "collectionGroup": "posts" }`, `{ "get": "users/alice" }`, `{ "collections": "users/alice" }`, `{ "set": "users/alice", "data": {...} }`, `{ "update": "users/alice", "data": {...} }` (mescla; o documento precisa existir), `{ "delete": "users/alice" }`. Operadores: `== != < <= > >= in not-in array-contains array-contains-any`. Comentários e vírgulas finais são permitidos.

## Notas sobre tipos
Valores especiais em `data`/filtros: `{"$timestamp": "ISO"}`, `{"$ref": "users/alice"}`, `{"$bytes": "base64"}`, `{"$geo": [lat, lng]}`, `{"$int": "9007199254740993"}` (um número JSON solto é arredondado pelo JSON.parse antes de ser enviado). Os inteiros voltam exatos; mapas e arrays são JSON. Os documentos não têm esquema: as colunas são a união dos campos dos documentos devolvidos, mais `__name__` (o caminho do documento).

## Limites (com honestidade)
- Os resultados não são enviados em streaming: uma consulta devolve no máximo `limit` (ou `maxRows`, ou 10.000) documentos. Cada leitura de documento é **cobrada** no Google Cloud.
- Sem transações, gravações em lote, listeners, consultas de agregação, busca vetorial, ferramentas de regras de segurança nem gerenciamento de índices; os erros de índice composto do servidor são mostrados como erros de sintaxe.
- Excluir um documento não exclui suas subcoleções.
- Ainda não há cursores de paginação.

## Imposição do somente leitura
No cliente: só `from`/`collectionGroup`/`get`/`collections` executam em uma conexão somente leitura (nega por padrão; uma entrada que não pode ser analisada conta como gravação). Para uma garantia no servidor, use um papel IAM só com acesso de leitura.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d firestore` e depois `pnpm --filter @rizomadb/driver-firestore test` (porta 18080, projeto `rizoma-test`; substitua com `RZ_FIRESTORE_PORT`).
