# Apache Cassandra / ScyllaDB

**Nível:** 2 · **Versões testadas:** Apache Cassandra 5.0 (testada). O ScyllaDB 6.2.3 (nó único, modo desenvolvedor) passa nos mesmos 10 testes (`RZ_CASSANDRA_PORT=19043 RZ_CASSANDRA_EXPECT=ScyllaDB`); o driver o detecta por `system.versions` e oculta as views materializadas ocultas `<índice>_index` que o Scylla cria para os índices secundários. Clusters de vários nós, Scylla Cloud, Alternator (API do DynamoDB) e recursos específicos do Scylla **não** são testados.

## Autenticação e transporte
Usuário/senha (PasswordAuthenticator) e TLS opcional, por meio do `cassandra-driver` (Apache-2.0). O data center local é obrigatório. Kerberos, certificados de cliente e os pacotes seguros do Astra **não** são suportados.

## Capacidades
Editor CQL (roda no modo do editor SQL), parâmetros preparados (`?`), paginação com um tamanho de busca limitado, keyspaces como esquemas, tabelas, views, chaves de partição/clustering e índices secundários no explorador. Não editável na grade.

## Notas sobre tipos
`bigint` mantém a precisão de 64 bits; `decimal` e `varint` são texto exato; coleções, tuplas e UDTs são JSON; `uuid`, `inet`, `date`, `time` e `duration` são texto; `timestamp` é `Date`.

## Limites (com honestidade)
- O nível de consistência é o padrão do driver (LOCAL_ONE); ainda não pode ser alterado.
- Sem auxiliares de batch/LWT, sem tracing, sem gerenciamento de views materializadas.
- Um resultado vazio só anuncia os nomes das colunas quando o servidor os envia (os tipos podem ser `unknown`).
- Cancelar para de ler e fecha o stream; o coordenador pode terminar a requisição.

## Imposição do somente leitura
No cliente: só `SELECT`, `USE`, `DESCRIBE`, `LIST` executam em uma conexão somente leitura (nega por padrão). Para uma garantia no servidor, use um papel limitado a SELECT.

## Ferramentas externas
nenhuma

## Licença do driver
Apache-2.0 (`cassandra-driver` 4.10.0)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d cassandra` (ou `scylla`) (leva cerca de um minuto para aceitar conexões) e depois `pnpm --filter @rizomadb/driver-cassandra test` (porta 19042, data center `datacenter1`, substitua a porta com `RZ_CASSANDRA_PORT`).
