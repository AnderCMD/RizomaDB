# Escrever um driver

Um driver é um objeto que implementa `DriverPlugin` de `@rizomadb/driver-api`:

```ts
export const myDriver: DriverPlugin = {
  id: "mydb", displayName: "MyDB", family: "relational", capabilities, quoteIdent, placeholder: (i) => `$${i}`,
  selectTop: (table, n) => `SELECT * FROM ${table} LIMIT ${n}`, connectionSchema,
  async connect(cfg, ctx) { /* devolve uma Connection */ },
};
```
Mantenha os metadados (`meta.ts`: capacidades, esquema, citação) em um arquivo que não importe a biblioteca cliente, para que o host da extensão possa mostrar o formulário de conexão sem carregá-la.

Uma `Connection` oferece `execute(req, signal)` (um iterador assíncrono de `columns`, lotes de `rows` e um evento `done`, respeitando `maxRows`, `batchSize` e o `AbortSignal`), `introspect()`, `ping()`, `close()` e, opcionalmente, `begin()`.

Regras:
1. Os erros são `DriverError` com um `kind` preciso (`syntax`, `authentication`, `permission`, `constraint`, `timeout`, `cancelled`, `connection`). Os erros de sintaxe levam um `position` baseado em 1 quando o motor o informa.
2. Os inteiros de 64 bits além de 2^53 são `bigint`; os decimais são strings; o JSON é `{ json }`; nunca perca precisão em silêncio, documente-o se a biblioteca cliente o impuser.
3. Se o servidor pode encerrar uma conexão no meio de uma consulta, garanta que as leituras pendentes sejam rejeitadas (veja os drivers do PostgreSQL e do MySQL para saber como os travamentos foram corrigidos).
4. Declare `readOnlyEnforcement` com honestidade (`server` apenas se o motor rejeitar as gravações por si só).
5. Os motores que não são SQL definem `language`, `assess()` (o risco de um comando) e, para edição, `generateChange()`.

Execute o kit compartilhado nos seus testes: `runConformance({ plugin, config, slowSql, paramSql, ... })` de `@rizomadb/driver-api/conformance`. Todo driver incluído o passa contra um servidor real. Os drivers de terceiros são publicados como pacotes npm que exportam um `DriverPlugin`; carregá-los na extensão **ainda não está implementado** (os drivers são incluídos em tempo de compilação).
