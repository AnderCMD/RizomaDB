# Google Cloud Firestore

**Niveau :** 2 · **Versions testées :** l'émulateur Firestore (image `emulators` de Google Cloud CLI, mode Firestore Native, API REST v1) (testée). **Google Cloud lui-même n'a pas été testé**, donc son bon fonctionnement là-bas n'est pas confirmé ; les requêtes sont les mêmes appels REST, avec un jeton Bearer. Testez-le avec un compte en lecture seule ou un projet jetable avant de vous y fier.

## Authentification et transport
Émulateur : sans identifiants. Google Cloud : un **jeton d'accès** OAuth collé dans la connexion (par exemple `gcloud auth print-access-token` ; il expire au bout d'environ une heure). On peut utiliser à la place un **fichier d'identifiants Google** (champ, `GOOGLE_APPLICATION_CREDENTIALS`, ou le fichier qu'écrit `gcloud auth application-default login`) : une clé de compte de service ou un fichier d'utilisateur autorisé. RizomaDB demande alors lui-même au point d'accès de jetons de Google (le `token_uri` du fichier, HTTPS uniquement) des jetons de courte durée et les renouvelle ; rien n'est écrit sur le disque. C'est une requête que l'extension fait en votre nom, uniquement quand vous vous connectez à Google Cloud. L'identité de charge de travail, le serveur de métadonnées de GCE/Cloud Run et les fichiers de compte externe ne sont **pas** pris en charge. L'échange de jetons est testé contre un substitut local du point d'accès de jetons (l'assertion signée est vérifiée avec la clé publique), **pas contre Google**.

## Capacités
Une console JSON (fonctionne dans le mode de l'éditeur JSON) : `{ "from": "users", "where": [["age", ">=", 18]], "orderBy": [["age", "desc"]], "limit": 20, "select": ["name"] }`, `{ "collectionGroup": "posts" }`, `{ "get": "users/alice" }`, `{ "collections": "users/alice" }`, `{ "set": "users/alice", "data": {...} }`, `{ "update": "users/alice", "data": {...} }` (fusion ; le document doit exister), `{ "delete": "users/alice" }`. Opérateurs : `== != < <= > >= in not-in array-contains array-contains-any`. Les commentaires et les virgules finales sont autorisés.

## Notes sur les types
Valeurs spéciales dans `data`/filtres : `{"$timestamp": "ISO"}`, `{"$ref": "users/alice"}`, `{"$bytes": "base64"}`, `{"$geo": [lat, lng]}`, `{"$int": "9007199254740993"}` (un nombre JSON nu est arrondi par JSON.parse avant d'être envoyé). Les entiers reviennent exacts ; maps et tableaux sont du JSON. Les documents n'ont pas de schéma : les colonnes sont l'union des champs des documents renvoyés, plus `__name__` (le chemin du document).

## Limites (en toute honnêteté)
- Les résultats ne sont pas diffusés en continu : une requête renvoie au plus `limit` (ou `maxRows`, ou 10 000) documents. Chaque lecture de document est **facturée** sur Google Cloud.
- Pas de transactions, d'écritures par lots, d'écouteurs, de requêtes d'agrégation, de recherche vectorielle, d'outils de règles de sécurité ni de gestion des index ; les erreurs d'index composite du serveur sont affichées comme des erreurs de syntaxe.
- Supprimer un document ne supprime pas ses sous-collections.
- Pas encore de curseurs de pagination.

## Application de la lecture seule
Côté client : seuls `from`/`collectionGroup`/`get`/`collections` s'exécutent sur une connexion en lecture seule (refus par défaut, une entrée non analysable compte comme une écriture). Pour une garantie côté serveur, utilisez un rôle IAM avec accès en lecture seule.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d firestore` puis `pnpm --filter @rizomadb/driver-firestore test` (port 18080, projet `rizoma-test` ; modifiable avec `RZ_FIRESTORE_PORT`).
