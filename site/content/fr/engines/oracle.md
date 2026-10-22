# Oracle Database

**Niveau :** 1 · **Versions testées en CI :** Oracle Free 23ai (testée) ; 12c+ attendue

## Authentification et transport
utilisateur/mot de passe en mode thin (pas besoin d'Oracle Client) ; wallet/Kerberos NON implémentés

## Capacités
Comme PostgreSQL ; EXPLAIN via PLAN_TABLE

## Notes sur les types
NUMBER lu en texte et converti (exact) ; CLOB en texte

## Application de la lecture seule
Pas de mode lecture seule de session : garde d'instructions côté client. `DBMS_SESSION.SLEEP` ne peut pas être interrompu par l'annulation ; les requêtes liées au CPU le peuvent

## Outils externes
aucun (Data Pump nécessite les outils de l'éditeur)

## Licence du pilote
oracledb thin (Apache-2.0 OR UPL-1.0)

## Écran de table (filtre, pagination, menu de colonne)
Vérifié sur un vrai serveur dans `apps/extension/src/lib/engines.integration.test.mts` : Oracle Free 23ai (filtre, pagination, renommer/type/défaut/NOT NULL/ajouter/supprimer une colonne ; les noms sont ceux en majuscules qu'Oracle stocke).

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d <service>` puis `RZ_ENGINES=oracle pnpm test` (voir `test/compose/docker-compose.yml` pour les ports et `packages/test-engines` pour les utilitaires).
