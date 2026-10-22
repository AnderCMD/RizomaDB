# Trino

**Niveau :** 2 · **Versions testées :** Trino 470, nœud unique, catalogue `memory` (testée). Starburst, Athena (basé sur Trino mais un autre service), Presto et les clusters sécurisés (OAuth, Kerberos, certificats client) ne sont **pas** testés.

## Authentification et transport
Nom d'utilisateur (`X-Trino-User`) via HTTP ou HTTPS ; mot de passe facultatif (HTTP basic, accepté uniquement via TLS). OAuth2, Kerberos, JWT et les certificats client ne sont **pas** pris en charge.

## Capacités
Éditeur SQL (dialecte ANSI), paramètres `?` (envoyés comme instruction `PREPARE` + `EXECUTE ... USING` avec des littéraux échappés), streaming des pages de résultats, sélection du catalogue/schéma, schémas, tables, vues et colonnes dans l'explorateur (depuis `information_schema` du catalogue configuré), `EXPLAIN` en texte. Non modifiable dans la grille.

## Notes sur les types
`bigint` reste exact (nécessite un environnement avec accès à la source dans `JSON.parse` : VS Code 1.100+ convient) ; `decimal` est du texte ; tableaux, maps et lignes sont du JSON ; `varbinary` est en octets ; dates et horodatages arrivent sous forme de texte du serveur.

## Limites (en toute honnêteté)
- Seul le catalogue configuré est parcouru ; les requêtes entre catalogues fonctionnent en écrivant `catalogue.schéma.table`.
- Trino n'a ni clés primaires ni clés étrangères : l'explorateur n'en montre aucune et les outils de conception/diff de schéma ne sont pas pris en charge pour Trino.
- Pas de transactions ; pas d'affichage de la progression de la requête ; la requête est annulée par `DELETE` sur l'URI de l'instruction.
- Les instructions préparées sont par requête ; une très longue liste de paramètres est envoyée sous forme de littéraux.

## Application de la lecture seule
Côté client : seuls `SELECT`, `WITH`, `VALUES`, `SHOW`, `DESCRIBE` et `EXPLAIN` (pas `EXPLAIN ANALYZE` d'une écriture) passent sur une connexion en lecture seule ; tout le reste, y compris les entrées à plusieurs instructions, est rejeté. Pour une garantie côté serveur, utilisez les règles de contrôle d'accès de Trino.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d trino` (environ une minute pour démarrer) puis `pnpm --filter @rizomadb/driver-trino test` (port 18081 ; modifiable avec `RZ_TRINO_PORT`).
