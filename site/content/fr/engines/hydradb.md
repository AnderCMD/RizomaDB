# HydraDB

**Statut :** expérimental (affiché avec un badge Expérimental). **Niveau :** 2 · **Versions testées :** `ghcr.io/hydra-db/hydradb:latest` (image construite le 2026-09-29, journaux HydraDB 0.1.x, API de requête HTTP `v1`), nœud unique, en clair. Les autres versions, les clusters et les déploiements TLS **ne sont pas testés**.

HydraDB est une base de données de graphes sur stockage objet qui parle OpenCypher via Bolt et via une API de requête HTTP ([github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb), AGPL-3.0). À ne pas confondre avec Hydra, l'entrepôt de données basé sur Postgres.

## Authentification et transport
Jeton Bearer via l'API de requête HTTP (port par défaut 8443). Le port Bolt n'est **pas** utilisé. Outre l'hôte, le port et le jeton, le formulaire demande le **graphe** (`default`) et l'**ID de la cellule** (`cell-0`) : HydraDB ne sait pas lister les cellules, et une mauvaise répond par un HTTP 500 opaque (le pilote ajoute un indice). Un en-tête de namespace est facultatif. Les serveurs déployés exigent TLS (`Utiliser TLS`) ; le HTTP simple est pour le développement local.

## Capacités
Éditeur Cypher, paramètres positionnels liés comme `$p1`, `$p2`…, résultats diffusés en NDJSON (les lignes arrivent dans la grille pendant que le serveur les produit encore), annulation (interrompt la requête et appelle le point d'accès d'annulation du serveur), `maxRows`. Non modifiable dans la grille. Pas de transactions.

## Notes sur les types
Les cellules sont typées par le serveur : `vertex_id` et `integer` gardent la précision complète de 64 bits (les entiers exacts sont mis entre guillemets avant l'analyse), les flottants, booléens, chaînes et nulls correspondent directement ; les listes sont affichées en JSON ; les chemins sont affichés tels que le serveur les encode.

## Limites (en toute honnêteté)
- **L'arborescence n'affiche que les étiquettes que vous listez dans la connexion** (« Étiquettes à afficher dans l'arborescence »). HydraDB n'a pas de `CALL db.labels()`, donc les étiquettes, propriétés et types de relations ne peuvent pas être découverts. Ouvrir une étiquette exécute `MATCH (n:Étiquette) RETURN n.id AS id` ; écrivez votre propre requête pour voir d'autres propriétés.
- HydraDB accepte un **sous-ensemble** d'OpenCypher : pas de `RETURN n`, pas de `RETURN *`, pas d'arithmétique dans `RETURN`, écritures uniquement sous forme de motifs d'arête ou de lots `UNWIND`, et plus (voir le `USING-HYDRADB.md` du serveur). Le pilote transmet votre instruction et affiche le message du serveur.
- Les vérifications d'existence sur des ids nus ne sont pas fiables par conception du serveur (un `MATCH` ancré sur un id renvoie une ligne fantôme) : ancrez-vous sur une étiquette.
- Pas de visionneuse `EXPLAIN` ni d'outils ER/conception.

## Application de la lecture seule
Côté client : le classificateur Cypher qui refuse par défaut rejette tout ce qui n'est pas reconnu comme une lecture (`MERGE`, `CREATE`, `SET`, `DELETE`, procédures inconnues, plusieurs instructions). `algo.SPpaths`, `algo.SSpaths` et `algo.MSpaths` comptent comme des lectures. Pour une garantie côté serveur, utilisez un jeton sans droits d'écriture, si votre déploiement en a un.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d hydradb` puis `pnpm --filter @rizomadb/driver-hydradb test` (port HTTP 18443, modifiable avec `RZ_HYDRADB_PORT` ; le jeton de test est dans `test/compose/hydradb-auth-token`). Le CI l'exécute dans le job `engines-extra`, qui démarre le moteur depuis le fichier compose (l'image a besoin d'un fichier de jeton, donc ce ne peut pas être un service du job).
