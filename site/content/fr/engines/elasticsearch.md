# Elasticsearch / OpenSearch

**Niveau :** 2 · **Versions testées en CI :** Elasticsearch 8.15, OpenSearch 2.17 (testées)

## Authentification et transport
authentification basique, clé d'API, TLS

## Capacités
Console REST avec commentaires et virgules finales, streaming par scroll, mappings. Non modifiable dans la grille

## Notes sur les types
Champs de _source en colonnes ; imbriqués en JSON

## Application de la lecture seule
Garde côté client (endpoints de lecture uniquement) ; utilisez un rôle en lecture seule pour une garantie côté serveur

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=elasticsearch pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
