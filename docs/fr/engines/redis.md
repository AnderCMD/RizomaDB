# Redis / Valkey

**Niveau :** 1 · **Versions testées en CI :** Redis 7, Valkey 8 (testées)

## Authentification et transport
mot de passe/utilisateur ACL, TLS

## Capacités
Navigateur de clés (SCAN avec le curseur géré pour vous ; KEYS est refusé), visionneuse par type (OPEN), console, TTL/renommer/supprimer avec confirmation, et **Modifier la valeur de la clé…** pour les chaînes (l'expiration est conservée), les champs de hash, les éléments de liste, les membres d'ensemble (renommés : le nouveau membre est ajouté avant que l'ancien soit retiré), les scores d'ensembles triés (membres existants uniquement) et les entrées de streams. Les entrées d'un stream ne sont jamais modifiées sur place : **Modifier la valeur de la clé…** sur un stream ajoute une entrée (XADD, avec un ID automatique ou explicite) ou en supprime une (XDEL). Tout cela est testé contre un vrai Redis ; le texte avec guillemets, sauts de ligne et emoji est conservé. NON implémenté : MONITOR/Pub-Sub, groupes de consommateurs, analyse de la mémoire

## Notes sur les types
Chaînes exactes ; les réponses entières sont des nombres JS (au-delà de 2^53 elles peuvent perdre en précision)

## Application de la lecture seule
Garde côté client à partir d'une table statique de commandes ; les commandes inconnues comptent comme des écritures. Utilisez un utilisateur ACL avec `+@read` pour une garantie côté serveur

## Outils externes
aucun

## Licence du pilote
ioredis (MIT)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=redis pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
