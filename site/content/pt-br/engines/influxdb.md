# InfluxDB 2.x

**Nível:** 2 · **Versões testadas:** InfluxDB 2.7.12 OSS (testada). O InfluxDB 3 (SQL/InfluxQL), o InfluxDB 1.x e o InfluxDB Cloud **não** são suportados/testados.

## Autenticação e transporte
Token de API (Authorization: Token …) sobre HTTP ou HTTPS, mais o nome da organização. Crie um token somente leitura para uso somente leitura.

## Capacidades
Editor Flux (roda no modo do editor SQL), streaming de CSV anotado, colunas tipadas (long, double, boolean, dateTime, base64Binary), buckets como «esquemas» e measurements como «tabelas» com as chaves de tag/field no explorador. Não editável na grade.

## Notas sobre tipos
Os valores `dateTime` são `Date`; os inteiros de 64 bits mantêm a precisão. Séries com conjuntos de tags diferentes dão colunas diferentes: as primeiras 2000 linhas decidem o conjunto de colunas (os valores ausentes são nulos); as colunas que aparecem só depois são descartadas com uma mensagem. Use `pivot()`/`keep()` para controlar a forma.

## Limites (com honestidade)
- Sem parâmetros posicionais (o Flux não tem): escreva os literais no script.
- A introspecção varre toda a retenção (`start: 0`) e pode ser lenta em buckets grandes.
- Sem gravação pela grade, sem importação de line protocol, sem gerenciamento de tarefas/alertas.
- Sem visualizador de plano.

## Imposição do somente leitura
No cliente: os scripts que usam `to()`, tarefas ou pacotes que saem do InfluxDB (http, sql, mqtt, secrets, notification endpoints) são rejeitados em uma conexão somente leitura. Para uma garantia no servidor, use um token somente leitura.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d influxdb` e depois `pnpm --filter @rizomadb/driver-influxdb test` (porta 18086, substitua com `RZ_INFLUXDB_PORT`; a organização/token de teste estão no arquivo compose).
