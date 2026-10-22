# InfluxDB 3 (Core / Enterprise)

**Niveau :** 2 · **Versions testées :** InfluxDB 3 Core 3.12.1, nœud unique, stockage d'objets sur fichier, démarré avec `--without-auth` (testée). Enterprise, Cloud Dedicated/Serverless et les serveurs authentifiés utilisent la même API HTTP et un jeton Bearer, mais **ne sont pas** testés.

## Authentification et transport
Jeton d'API facultatif (`Authorization: Bearer …`) via HTTP ou HTTPS. Le nom de la base de données fait partie de la connexion.

## Capacités
Éditeur SQL (dialecte DataFusion ; les aides ANSI s'appliquent), paramètres positionnels (`$p1`, `$p2`…), streaming en JSON-lines, tables et colonnes dans l'explorateur (depuis `information_schema`), `EXPLAIN` en texte. InfluxQL et l'API d'écriture (line protocol) ne sont pas utilisés.

## Notes sur les types
Le serveur n'envoie pas les types des résultats : les types sont déduits des valeurs (entier ou flottant est décidé par le littéral JSON ; les horodatages arrivent en texte ISO et ne deviennent des dates que s'ils portent un suffixe de fuseau horaire). Les entiers 64 bits restent exacts (nécessite un environnement avec accès à la source dans `JSON.parse`). La colonne `time` est affichée en premier. Les lignes ayant des colonnes différentes sont réunies sur les 2000 premières lignes.

## Limites (en toute honnêteté)
- En lecture seule par construction : le point d'accès SQL rejette `INSERT`/`DELETE`/DDL, et le pilote n'appelle jamais le point d'accès d'écriture. Écrire des données, la rétention, les déclencheurs et le moteur de traitement sont hors périmètre.
- Une base de données par connexion ; pas de sélecteur de base de données.
- Pas de visionneuse de plan au-delà de `EXPLAIN` en texte.

## Application de la lecture seule
Côté serveur pour le chemin SQL (le point d'accès ne peut pas modifier les données) ; les jetons peuvent en plus être restreints.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d influxdb3` puis `pnpm --filter @rizomadb/driver-influxdb3 test` (port 18181 ; modifiable avec `RZ_INFLUXDB3_PORT`).
