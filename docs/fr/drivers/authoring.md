# Écrire un pilote

Un pilote est un objet qui implémente `DriverPlugin` de `@rizomadb/driver-api` :

```ts
export const myDriver: DriverPlugin = {
  id: "mydb", displayName: "MyDB", family: "relational", capabilities, quoteIdent, placeholder: (i) => `$${i}`,
  selectTop: (table, n) => `SELECT * FROM ${table} LIMIT ${n}`, connectionSchema,
  async connect(cfg, ctx) { /* renvoie une Connection */ },
};
```
Gardez les métadonnées (`meta.ts` : capacités, schéma, citation) dans un fichier qui n'importe pas la bibliothèque cliente, afin que l'hôte de l'extension puisse afficher le formulaire de connexion sans la charger.

Une `Connection` fournit `execute(req, signal)` (un itérateur asynchrone de `columns`, de lots de `rows` et d'un événement `done`, respectant `maxRows`, `batchSize` et l'`AbortSignal`), `introspect()`, `ping()`, `close()` et, facultativement, `begin()`.

Règles :
1. Les erreurs sont des `DriverError` avec un `kind` précis (`syntax`, `authentication`, `permission`, `constraint`, `timeout`, `cancelled`, `connection`). Les erreurs de syntaxe portent un `position` base 1 quand le moteur le fournit.
2. Les entiers 64 bits au-delà de 2^53 sont des `bigint` ; les décimaux sont des chaînes ; le JSON est `{ json }` ; ne perdez jamais de précision en silence, documentez-le si la bibliothèque cliente l'impose.
3. Si le serveur peut terminer une connexion en pleine requête, assurez-vous que les lectures en attente sont rejetées (voir les pilotes PostgreSQL et MySQL pour la façon dont les blocages ont été corrigés).
4. Déclarez `readOnlyEnforcement` honnêtement (`server` seulement si le moteur rejette lui-même les écritures).
5. Les moteurs non SQL définissent `language`, `assess()` (le risque d'une commande) et, pour la modification, `generateChange()`.

Exécutez le kit partagé dans vos tests : `runConformance({ plugin, config, slowSql, paramSql, ... })` de `@rizomadb/driver-api/conformance`. Chaque pilote embarqué le réussit contre un vrai serveur. Les pilotes tiers sont publiés comme paquets npm exportant un `DriverPlugin` ; leur chargement dans l'extension **n'est pas encore implémenté** (les pilotes sont embarqués à la compilation).
