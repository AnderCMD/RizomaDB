# MySQL / MariaDB

**Niveau :** 1 · **Versions testées en CI :** MySQL 8.4 et MariaDB 11 (testées)

## Authentification et transport
utilisateur/mot de passe, TLS, tunnel SSH

## Capacités
Comme PostgreSQL ; les verrous d'administration utilisent les vues de MySQL 8 (la vue des verrous de MariaDB n'est pas implémentée)

## Notes sur les types
BIGINT exact, DECIMAL en chaîne, JSON en JSON, BIT/BLOB en octets

## Application de la lecture seule
Mode de transaction `READ ONLY` de la session sur les connexions en lecture seule

## Outils externes
`mysqldump`, `mysql` (détectés dans le PATH)

## Licence du pilote
mysql2 (MIT)

## Écran de table (filtre, pagination, menu de colonne)
Vérifié sur un vrai serveur dans `apps/extension/src/lib/engines.integration.test.mts` : MySQL 8.4 (filtre, pagination, renommer/type/défaut/NOT NULL/ajouter/supprimer une colonne).

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=mysql pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).

## TiDB
Le pilote MySQL réussit le kit de conformité complet (15/15) contre TiDB v8.5.1 (nœud unique, `pingcap/tidb`, stockage unistore ; `RZ_TIDB_PORT`, 14000 par défaut). TiDB n'implémente `SET ... READ ONLY` que comme une opération sans effet, donc pour TiDB le pilote **ne** s'y fie **pas** : les connexions en lecture seule sont appliquées dans le pilote par une vérification d'instructions qui refuse par défaut (lectures, `SHOW`, `EXPLAIN`, `WITH ... SELECT` ; tout le reste, les entrées à plusieurs instructions, `FOR UPDATE` et `INTO OUTFILE` sont rejetés). C'est une garantie côté client ; pour une garantie côté serveur, utilisez un utilisateur TiDB avec uniquement des droits SELECT. Non testé : clusters TiKV, TiDB Cloud, TLS, règles de placement, DDL propre à TiDB dans le concepteur de schéma.
