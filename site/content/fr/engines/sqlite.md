# SQLite

**Niveau :** 1 · **Versions testées en CI :** SQLite tel qu'embarqué dans l'environnement d'exécution Node (`node:sqlite`)

## Authentification et transport
chemin du fichier

## Capacités
Tout sauf les outils d'administration ; l'ALTER de colonnes nécessite de reconstruire la table (signalé comme une étape manuelle)

## Notes sur les types
INTEGER exact (bigint au-delà de 2^53)

## Application de la lecture seule
`PRAGMA query_only`

## Outils externes
`VACUUM INTO` intégré pour les sauvegardes

## Licence du pilote
node:sqlite (aucune dépendance) ; NOTE : sa disponibilité dans le Node embarqué de VS Code n'est pas vérifiée (voir l'ADR 0009)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=sqlite pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
