# ClickHouse

**Niveau :** 2 · **Versions testées en CI :** ClickHouse 24.8 (testée)

## Authentification et transport
utilisateur/mot de passe via HTTP(S)

## Capacités
Requêtes, explorateur, export, EXPLAIN (texte). Les lignes ne sont pas modifiables (les mutations sont asynchrones)

## Notes sur les types
Int64/UInt64 exacts ; dates en chaînes ISO

## Application de la lecture seule
`readonly=2` imposé par le serveur

## Outils externes
aucun

## Licence du pilote
@clickhouse/client (Apache-2.0)

## Écran de table (filtre, pagination, menu de colonne)
Vérifié sur un vrai serveur dans `apps/extension/src/lib/engines.integration.test.mts` : ClickHouse 24.8 (filtre et pagination seulement : les colonnes ne sont pas modifiées depuis la grille sur ce moteur).

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=clickhouse pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
