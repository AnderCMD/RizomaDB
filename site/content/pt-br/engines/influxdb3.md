# InfluxDB 3 (Core / Enterprise)

**Nível:** 2 · **Versões testadas:** InfluxDB 3 Core 3.12.1, nó único, armazenamento de objetos em arquivo, iniciado com `--without-auth` (testada). O Enterprise, o Cloud Dedicated/Serverless e os servidores autenticados usam a mesma API HTTP e um token Bearer, mas **não** são testados.

## Autenticação e transporte
Token de API opcional (`Authorization: Bearer …`) sobre HTTP ou HTTPS. O nome do banco de dados faz parte da conexão.

## Capacidades
Editor SQL (dialeto DataFusion; os auxiliares ANSI se aplicam), parâmetros posicionais (`$p1`, `$p2`…), streaming em JSON-lines, tabelas e colunas no explorador (de `information_schema`), `EXPLAIN` em texto. O InfluxQL e a API de gravação (line protocol) não são usados.

## Notas sobre tipos
O servidor não envia os tipos do resultado: os tipos são inferidos dos valores (inteiro ou float é decidido pelo literal JSON; os timestamps chegam como texto ISO e só viram datas quando têm um sufixo de fuso horário). Os inteiros de 64 bits continuam exatos (exige um runtime com acesso à origem em `JSON.parse`). A coluna `time` é mostrada primeiro. Linhas com colunas diferentes são unidas ao longo das primeiras 2000 linhas.

## Limites (com honestidade)
- Somente leitura por construção: o endpoint SQL rejeita `INSERT`/`DELETE`/DDL e o driver nunca chama o endpoint de gravação. Gravar dados, retenção, gatilhos e o motor de processamento estão fora do escopo.
- Um banco de dados por conexão; sem alternador de banco de dados.
- Sem visualizador de plano além do `EXPLAIN` em texto.

## Imposição do somente leitura
No servidor para o caminho SQL (o endpoint não pode modificar dados); os tokens ainda podem ser restringidos.

## Ferramentas externas
nenhuma

## Licença do driver
nenhuma (construído sobre node:http)

## Executar os testes de integração
`docker compose -f test/compose/docker-compose.yml up -d influxdb3` e depois `pnpm --filter @rizomadb/driver-influxdb3 test` (porta 18181; substitua com `RZ_INFLUXDB3_PORT`).
