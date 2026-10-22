# Amazon DynamoDB

**Niveau :** 2 · **Versions testées :** DynamoDB Local 2.5.2 (testée). Le vrai service AWS utilise la même API et la même signature des requêtes (vérifiée avec le vecteur de test SigV4 publié par AWS), mais **n'a pas été testé avec AWS**, donc son bon fonctionnement là-bas n'est pas confirmé. Testez-le avec un utilisateur IAM en lecture seule ou une table jetable avant de vous y fier.

## Authentification et transport
Clés d'accès (ID de clé d'accès, clé d'accès secrète et jeton de session facultatif), signées avec SigV4 via HTTPS. Les clés saisies dans la connexion l'emportent ; sinon le champ **Profil AWS** lit un profil de `~/.aws/credentials` (ou `AWS_SHARED_CREDENTIALS_FILE` ; la région vient de `~/.aws/config`) ; sinon on utilise les variables d'environnement `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`. Les profils qui nécessitent SSO, l'assomption de rôle (`role_arn`) ou un programme auxiliaire (`credential_process`) sont refusés avec un message : exportez des clés temporaires et collez-les dans le champ du jeton de session. La prise en charge des profils est testée contre un point d'accès local qui enregistre comment les requêtes sont signées, **pas contre AWS**. Définissez l'hôte/le port/TLS du point d'accès pour DynamoDB Local ou un point d'accès VPC.

## Capacités
Éditeur PartiQL (fonctionne dans le mode de l'éditeur SQL) : `SELECT`/`INSERT`/`UPDATE`/`DELETE`, paramètres positionnels `?`, index secondaires globaux (`FROM "table"."index"`), pagination automatique, tables/clés/index dans l'explorateur. Non modifiable dans la grille.

## Notes sur les types
Les nombres sont exacts (les entiers au-delà de 2^53 sont des `bigint`, les décimaux non représentables restent du texte). Listes, maps et ensembles sont affichés en JSON. Les éléments n'ont pas de schéma : les colonnes viennent de la première page ; les attributs vus plus tard ne sont pas affichés (un message le signale).

## Limites (en toute honnêteté)
- Un `SELECT` sans condition de clé est un **scan** complet de la table qui consomme de la capacité de lecture ; le classificateur de risque le signale mais ne le bloque pas.
- Pas de transactions, pas de `CreateTable`/DDL (ce n'est pas du PartiQL), pas de streams, pas d'outils PITR/sauvegarde.
- La limitation de débit est signalée comme une erreur de délai d'expiration ; il n'y a pas de nouvelle tentative/backoff automatique.

## Application de la lecture seule
Côté client : seuls `SELECT`/`EXISTS` s'exécutent sur une connexion en lecture seule (refus par défaut). Pour une garantie côté serveur, utilisez une politique IAM limitée aux actions de lecture.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http et node:crypto)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d dynamodb` puis `pnpm --filter @rizomadb/driver-dynamodb test` (port 18000, modifiable avec `RZ_DYNAMODB_PORT`).
