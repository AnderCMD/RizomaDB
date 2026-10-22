# PostgreSQL

**Niveau :** 1 · **Versions testées en CI :** 17 (testée) ; 12–16 devraient fonctionner, mais ne sont pas en CI

## Authentification et transport
utilisateur/mot de passe, TLS (fichier d'AC ou magasin du système), tunnel SSH

## Capacités
Tout l'ensemble des fonctions SQL : file de modifications, concepteur de schéma, ER, comparaison, import/export, sauvegarde (pg_dump), administration, EXPLAIN (JSON, ANALYZE avec confirmation)

## Notes sur les types
int8 → exact (bigint au-delà de 2^53), jsonb → visionneuse JSON, tableaux sous forme de tableaux ; streaming avec pg-cursor

## Application de la lecture seule
`default_transaction_read_only` côté serveur sur les connexions en lecture seule ; `pg_stat_statements` facultatif pour les requêtes lentes

## Outils externes
`pg_dump`, `pg_restore` (détectés dans le PATH, jamais fournis ; PostgreSQL License)

## Licence du pilote
pg (MIT), pg-cursor (MIT)

## Écran de table (filtre, pagination, menu de colonne)
Vérifié sur un vrai serveur dans `apps/extension/src/lib/engines.integration.test.mts` : PostgreSQL 17 (filtre, pagination, renommer/type/défaut/NOT NULL/ajouter/supprimer une colonne).

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=postgres pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).

## CockroachDB
Le pilote PostgreSQL réussit le kit de conformité complet (15/15, y compris l'annulation de requêtes) contre CockroachDB v24.3.4, nœud unique, mode non sécurisé (`RZ_COCKROACH_PORT`, 26257 par défaut ; `docker compose ... up -d cockroach`). Le serveur est détecté à partir de `version()` et les requêtes sont annulées par `CANCEL QUERIES` de la session au lieu de `pg_cancel_backend`. Non testé : clusters sécurisés avec certificats client, clusters multi-nœuds, CockroachDB Cloud, gestion des nouvelles tentatives de sérialisation (40001) au-delà du signalement de l'erreur, et DDL propre à Cockroach (le concepteur de schéma cible la syntaxe PostgreSQL). Les changements de schéma prennent des secondes sur CockroachDB.

## YugabyteDB
Le pilote PostgreSQL réussit le kit de conformité complet (15/15, y compris l'annulation) contre YugabyteDB 2025.2.7 (YSQL, nœud unique, `yugabyted` ; `RZ_YUGABYTE_PORT`, 15433 par défaut ; `docker compose ... up -d yugabyte`, nécessite environ 2 Go de RAM). Le serveur est reconnu à partir de `version()` (`-YB-`). Non testé : clusters multi-nœuds ou géo-distribués, YugabyteDB Aeon (cloud), YCQL (utilisez le pilote Cassandra à vos risques : non testé), TLS, et erreurs de nouvelle tentative de transaction au-delà de leur signalement. Les changements de schéma sont lents sur YugabyteDB.
