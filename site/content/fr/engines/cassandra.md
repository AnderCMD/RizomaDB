# Apache Cassandra / ScyllaDB

**Niveau :** 2 · **Versions testées :** Apache Cassandra 5.0 (testée). ScyllaDB 6.2.3 (nœud unique, mode développeur) réussit les mêmes 10 tests (`RZ_CASSANDRA_PORT=19043 RZ_CASSANDRA_EXPECT=ScyllaDB`) ; le pilote le détecte via `system.versions` et masque les vues matérialisées cachées `<index>_index` que Scylla crée pour les index secondaires. Les clusters multi-nœuds, Scylla Cloud, Alternator (API DynamoDB) et les fonctions propres à Scylla ne sont **pas** testés.

## Authentification et transport
Nom d'utilisateur/mot de passe (PasswordAuthenticator) et TLS facultatif, via le `cassandra-driver` (Apache-2.0). Le centre de données local est obligatoire. Kerberos, les certificats client et les bundles sécurisés Astra ne sont **pas** pris en charge.

## Capacités
Éditeur CQL (fonctionne dans le mode de l'éditeur SQL), paramètres préparés (`?`), pagination avec une taille de récupération bornée, keyspaces comme schémas, tables, vues, clés de partition/clustering et index secondaires dans l'explorateur. Non modifiable dans la grille.

## Notes sur les types
`bigint` garde la précision 64 bits ; `decimal` et `varint` sont du texte exact ; collections, tuples et UDT sont du JSON ; `uuid`, `inet`, `date`, `time` et `duration` sont du texte ; `timestamp` est un `Date`.

## Limites (en toute honnêteté)
- Le niveau de cohérence est celui par défaut du pilote (LOCAL_ONE) ; il ne peut pas encore être changé.
- Pas d'aides pour batch/LWT, pas de tracing, pas de gestion des vues matérialisées.
- Un résultat vide n'annonce les noms de colonnes que si le serveur les envoie (les types peuvent être `unknown`).
- Annuler arrête la lecture et ferme le flux ; le coordinateur peut terminer la requête.

## Application de la lecture seule
Côté client : seuls `SELECT`, `USE`, `DESCRIBE`, `LIST` s'exécutent sur une connexion en lecture seule (refus par défaut). Pour une garantie côté serveur, utilisez un rôle limité à SELECT.

## Outils externes
aucun

## Licence du pilote
Apache-2.0 (`cassandra-driver` 4.10.0)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d cassandra` (ou `scylla`) (environ une minute avant d'accepter des connexions) puis `pnpm --filter @rizomadb/driver-cassandra test` (port 19042, centre de données `datacenter1`, modifiez le port avec `RZ_CASSANDRA_PORT`).
