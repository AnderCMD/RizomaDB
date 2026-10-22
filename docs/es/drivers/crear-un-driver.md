<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Escribir un driver

Un driver es un objeto que implementa `DriverPlugin` de `@rizomadb/driver-api`:

```ts
export const myDriver: DriverPlugin = {
  id: "mydb", displayName: "MyDB", family: "relational", capabilities, quoteIdent, placeholder: (i) => `$${i}`,
  selectTop: (table, n) => `SELECT * FROM ${table} LIMIT ${n}`, connectionSchema,
  async connect(cfg, ctx) { /* devuelve una Connection */ },
};
```
Mantén los metadatos (`meta.ts`: capacidades, esquema, citado de identificadores) en un archivo que no importe la biblioteca cliente, para que el host de la extensión pueda mostrar el formulario de conexión sin cargarla.

Una `Connection` ofrece `execute(req, signal)` (un iterador asíncrono de eventos `columns`, lotes de `rows` y un único `done`, que respeta `maxRows`, `batchSize` y el `AbortSignal`), `introspect()`, `ping()`, `close()` y, opcionalmente, `begin()`.

Reglas:
1. Los errores son `DriverError` con un `kind` preciso (`syntax`, `authentication`, `permission`, `constraint`, `timeout`, `cancelled`, `connection`). Los errores de sintaxis llevan una `position` (base 1) cuando el motor la informa.
2. Los enteros de 64 bits mayores que 2^53 son `bigint`; los decimales son texto; el JSON es `{ json }`; nunca pierdas precisión en silencio, y documéntalo si la biblioteca cliente te obliga a ello.
3. Si el servidor puede terminar una conexión a mitad de una consulta, asegúrate de que las lecturas pendientes se rechacen (mira los drivers de PostgreSQL y MySQL para ver cómo se resolvieron los bloqueos).
4. Declara `readOnlyEnforcement` con honestidad (`server` solo si el propio motor rechaza las escrituras).
5. Los motores que no son SQL definen `language`, `assess()` (el riesgo de un comando) y, para editar, `generateChange()`.
6. Una cancelación que sigue en vuelo cuando termina la consulta puede alcanzar la sentencia siguiente de la misma conexión: espera a que termine (con un límite de tiempo) antes de devolver el control, como hacen los drivers de PostgreSQL y MySQL.

Ejecuta el kit compartido en tus pruebas: `runConformance({ plugin, config, slowSql, paramSql, ... })` de `@rizomadb/driver-api/conformance`. Todos los drivers incluidos lo pasan contra un servidor real. Los drivers de terceros se publican como paquetes npm que exportan un `DriverPlugin`; cargarlos en la extensión **aún no está implementado** (los drivers se incluyen en tiempo de compilación).
