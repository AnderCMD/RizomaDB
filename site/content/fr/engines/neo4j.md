# Neo4j

**Niveau :** 2 · **Versions testées :** Neo4j 5.26 Community (testée). Les autres 5.x et Enterprise/Aura devraient fonctionner mais **ne sont pas testées** ; la 4.x n'est pas prise en charge (pas de Query API).

## Authentification et transport
Authentification basique via la Query API HTTP (port 7474, ou 7473 avec TLS). Le protocole Bolt n'est **pas** utilisé, donc aucune fonction propre à Bolt (routage, bookmarks entre sessions) n'est disponible. Utilisez le port HTTP dans le formulaire de connexion.

## Capacités
Éditeur Cypher (`.cypher`/`.cyp`, exécute l'instruction terminée par `;` sous le curseur), paramètres positionnels liés comme `$p1`, `$p2`…, transactions explicites (commit/rollback), étiquettes comme « tables » avec les types de propriétés de `db.schema.nodeTypeProperties()`, index de `SHOW INDEXES`. Non modifiable dans la grille.

## Notes sur les types
Les entiers gardent la précision complète de 64 bits (JSON typé) ; nœuds, relations, chemins, listes et maps sont affichés en JSON ; dates, durées et points reviennent sous forme de texte formaté par le serveur.

## Limites (en toute honnêteté)
- Les résultats sont renvoyés par le serveur en une seule réponse, sans streaming : utilisez `LIMIT`. `maxRows` tronque côté client après le téléchargement.
- Annuler interrompt la requête HTTP ; le serveur peut continuer à exécuter l'instruction jusqu'à ce qu'il remarque la connexion fermée.
- Pas de visionneuse de plan `EXPLAIN`.

## Application de la lecture seule
Côté client : un classificateur Cypher qui refuse par défaut (`assessCypher`) rejette tout ce qui n'est pas reconnu comme une lecture, y compris les procédures inconnues, `PROFILE`, `LOAD CSV` et les requêtes à plusieurs instructions. Pour une garantie côté serveur, utilisez un rôle Neo4j en lecture seule.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d neo4j` puis `pnpm --filter @rizomadb/driver-neo4j test` (port HTTP 17474, modifiable avec `RZ_NEO4J_PORT` ; les identifiants de test sont dans le fichier compose et dans le test).
