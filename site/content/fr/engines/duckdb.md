# DuckDB

**Niveau :** 2 · **Versions testées en CI :** DuckDB 1.5 (testée)

## Authentification et transport
chemin du fichier ou :memory:

## Capacités
Ensemble complet de fonctions SQL. La bibliothèque native dépend de la plateforme. Elle est incluse dans les fichiers VSIX par plateforme (darwin-arm64/x64, linux-x64/arm64, win32-x64/arm64 ; environ 38 Mo chacun) et NON dans le VSIX universel, où le pilote signale une erreur claire. Seul le paquet darwin-arm64 a été exécuté ici, plus celui de linux-x64 en CI ; les autres plateformes sont construites par le workflow de release, qui n'a jamais tourné, donc elles ne sont pas testées

## Notes sur les types
HUGEINT exact, DECIMAL en chaîne, LIST/STRUCT en JSON

## Application de la lecture seule
Garde d'instructions côté client

## Outils externes
aucun

## Licence du pilote
@duckdb/node-api (MIT)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=duckdb pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
