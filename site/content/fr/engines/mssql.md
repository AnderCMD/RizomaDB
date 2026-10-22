# SQL Server

**Niveau :** 1 · **Versions testées en CI :** SQL Server 2022 (testée)

## Authentification et transport
Login SQL, TLS, tunnel SSH (Windows/Kerberos/NTLM et Azure AD ne sont PAS implémentés)

## Capacités
Comme PostgreSQL ; EXPLAIN via SHOWPLAN_ALL

## Notes sur les types
BIGINT exact ; DECIMAL/NUMERIC arrivent comme des nombres JS depuis le pilote (tedious), donc les valeurs au-delà de 2^53 perdent en précision

## Application de la lecture seule
Il n'existe pas de mode lecture seule de session : le pilote rejette les instructions qui ne sont pas des lectures (garde côté client)

## Outils externes
aucun (la sauvegarde native nécessite les outils de l'éditeur)

## Licence du pilote
tedious (MIT)

## Écran de table (filtre, pagination, menu de colonne)
Vérifié sur un vrai serveur dans `apps/extension/src/lib/engines.integration.test.mts` : SQL Server 2022 (filtre, pagination, renommer/type/défaut/NOT NULL/ajouter/supprimer une colonne ; un défaut est changé en recherchant et remplaçant sa contrainte générée).

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=mssql pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
