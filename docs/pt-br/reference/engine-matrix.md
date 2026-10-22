# Matriz de capacidades por motor

O que cada motor suporta, lido das capacidades declaradas pelos drivers e das regras da extensão. Um traço significa *não suportado*; nunca é uma promessa de que será adicionado. Quais motores são testados contra um servidor real está na página de cada motor.

| Motor | Família | Linguagem de consulta | Editar linhas na grade | Cancelar | Somente leitura imposto por | Caixa de filtro da tabela | Edição de colunas | Plano de execução | Ferramentas de administração |
|---|---|---|---|---|---|---|---|---|---|
| PostgreSQL | relacional | sql | por chave primária | sim | o servidor | WHERE / ORDER BY | sim | sim | sim |
| MySQL / MariaDB | relacional | sql | por chave primária | sim | o servidor | WHERE / ORDER BY | sim | sim | sim |
| SQLite | relacional | sql | por chave primária | — | o servidor | WHERE / ORDER BY | sim | sim | — |
| SQL Server | relacional | sql | por chave primária | sim | RizomaDB (cliente) | WHERE / ORDER BY | sim | sim | sim |
| Oracle Database | relacional | sql | por chave primária | sim | RizomaDB (cliente) | WHERE / ORDER BY | sim | sim | sim |
| ClickHouse | relacional | sql | — | sim | o servidor | WHERE / ORDER BY | — | sim | — |
| DuckDB | relacional | sql | por chave primária | sim | RizomaDB (cliente) | WHERE / ORDER BY | — | sim | — |
| Trino | relacional | sql | — | sim | RizomaDB (cliente) | WHERE / ORDER BY | — | sim | — |
| MongoDB | documentos | mongo | por id do documento | sim | RizomaDB (cliente) | filtro / ordem (JSON) | — | sim | — |
| Redis / Valkey | chave-valor | redis | por chave | sim | RizomaDB (cliente) | — | — | — | — |
| Elasticsearch / OpenSearch | busca | json | — | sim | RizomaDB (cliente) | texto de busca / ordem | — | sim | — |
| Neo4j | grafos | cypher | — | sim | RizomaDB (cliente) | condição / ORDER BY | — | — | — |
| HydraDB (experimental) | grafos | cypher | — | sim | RizomaDB (cliente) | — | — | — | — |
| Amazon DynamoDB | chave-valor | sql | — | sim | RizomaDB (cliente) | — | — | — | — |
| Google Cloud Firestore | documentos | json | — | sim | RizomaDB (cliente) | — | — | — | — |
| InfluxDB 2.x | séries temporais | flux | — | sim | RizomaDB (cliente) | — | — | — | — |
| InfluxDB 3 | séries temporais | sql | — | sim | o servidor | — | — | sim | — |
| Apache Cassandra / ScyllaDB | colunas largas | cql | — | sim | RizomaDB (cliente) | — | — | — | — |

## Notas

- **Caixa de filtro da tabela**: a barra abaixo da linha de consulta ao abrir uma tabela; altera a instrução no banco de dados, então a paginação e a edição continuam funcionando.
- **Edição de colunas**: renomear, alterar tipo, NOT NULL, valor padrão, adicionar e excluir pelo menu da coluna; mostram o DDL exato e pedem confirmação.
- **Somente leitura imposto pelo servidor** significa que a própria conexão recusa escritas; por RizomaDB (cliente) significa que um classificador de instruções que nega por padrão faz isso, então, para uma garantia firme, use também um papel de banco de dados somente leitura.

*Gerado por `scripts/gen-reference.mjs` a partir do manifesto da extensão; não edite à mão.*
