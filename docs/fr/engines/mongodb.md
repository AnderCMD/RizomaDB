# MongoDB

**Niveau :** 1 · **Versions testées en CI :** MongoDB 7 (testée)

## Authentification et transport
utilisateur/mot de passe, URI, TLS ; Atlas SRV via URI (non testé avec Atlas, donc son bon fonctionnement là-bas n'est pas confirmé ; essayez d'abord en lecture seule)

## Capacités
Collections comme tables, file de modification de documents avec concurrence optimiste, analyseur de schéma, aperçu du pipeline étape par étape (texte), création/suppression d'index, import/export, mongodump/mongorestore

## Notes sur les types
ObjectId en chaîne hexadécimale, Long exact, Decimal128 en chaîne, documents imbriqués en JSON

## Application de la lecture seule
Garde côté client (liste autorisée de commandes de lecture) ; utilisez un utilisateur de base de données en lecture seule pour une garantie côté serveur

## Outils externes
`mongodump`, `mongorestore` (MongoDB Database Tools, détectés)

## Licence du pilote
mongodb (Apache-2.0)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=mongodb pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
