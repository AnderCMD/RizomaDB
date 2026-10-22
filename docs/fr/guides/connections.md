# Connexions

## L'écran Nouvelle connexion
**RizomaDB : Nouvelle connexion** ouvre un écran où chaque moteur est une carte avec son logo, regroupée par type. Choisissez-en un et remplissez le formulaire.

- **Valeurs par défaut par moteur.** L'hôte, le port et l'utilisateur habituel sont déjà là (par exemple PostgreSQL `postgres@localhost:5432/postgres`, MySQL et MariaDB `root`, SQL Server `sa`, Oracle `system` avec le service `FREEPDB1`, MongoDB et Redis sans utilisateur). Les champs dont un moteur n'a pas besoin restent vides et facultatifs.
- **TLS sur votre propre machine.** Pour `localhost`, `127.0.0.1` et `::1`, la case TLS démarre décochée, car les serveurs locaux parlent rarement TLS, et aucun avertissement n'est affiché. Changez l'hôte pour un hôte distant et elle revient à la valeur par défaut du moteur ; décocher TLS pour un hôte distant demande une confirmation.
- **Tester la connexion** se connecte et fait un ping sans rien conserver. **Enregistrer la connexion** conserve le profil et se connecte ; si cela échoue, vous pouvez corriger les champs et réessayer, ou choisir **Enregistrer sans se connecter**.
- **Les services cloud ne sont pas confirmés.** RizomaDB n'a été testé qu'avec des moteurs locaux et des émulateurs officiels, jamais avec un vrai compte cloud (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gérés). Essayez d'abord avec un utilisateur en lecture seule ou une base jetable ; voir [Moteurs](../engines/README.md#cloud-et-services-gérés-non-confirmés).
- Les mots de passe, jetons et clés vont dans le **stockage de secrets** de VS Code. Un catalogue partagé ne les contient jamais : chacun saisit les siens.

### Environnements et protection
Chaque connexion a un environnement. `prod` est en lecture seule par défaut et `staging` demande avant chaque écriture. Choisissez **Nouvel environnement…** dans le formulaire pour créer le vôtre : donnez-lui un nom (lettres minuscules, chiffres et tirets) et une protection :

| Protection | Effet |
|---|---|
| Demander avant chaque écriture | Une confirmation pour chaque instruction qui modifie des données |
| Bloquer les écritures | L'environnement est en lecture seule |
| Aucune protection | Rien de plus |

Les nouveaux environnements sont enregistrés dans le paramètre `rizomadb.environments`, où vous pouvez aussi les modifier. Ils ne peuvent que rendre les choses plus strictes que vos fichiers de politique, jamais plus souples. Voir [Politiques](../enterprise/policy.md).

### Chemin réseau
Par défaut, RizomaDB se connecte directement. Sous **Chemin réseau**, vous pouvez passer par un **tunnel SSH** (fichier de clé ou mot de passe, avec vérification stricte de la clé de l'hôte et une invite pour les hôtes inconnus) ou par un **proxy HTTP** / **proxy SOCKS5** (avec utilisateur et mot de passe facultatifs). Une connexion utilise un tunnel SSH *ou* un proxy, pas les deux.

## Connexions enregistrées
Le deuxième onglet du même écran liste les connexions que vous avez. Chaque carte affiche le logo du moteur, l'environnement, si elle est en lecture seule ou partagée, la cible (`hôte:port`) et sa **base de données**, et si elle est connectée. Un badge **● Active** marque celle qui est utilisée. Les boutons connectent ou déconnectent, ouvrent une nouvelle requête, basculent la lecture seule et suppriment.

## L'arborescence des connexions
- Les connexions sont regroupées par type de moteur (désactivez avec `rizomadb.explorer.groupByFamily`).
- Chaque ligne porte le logo du moteur, `[ENVIRONNEMENT]`, la base de données et un point pour la connexion active.
- Sous une connexion : **Tables** (ou Collections, Clés, Index, Étiquettes, Mesures, selon le moteur) avec un compteur, et **Vues**.
- Survolez une ligne pour des boutons rapides. Le titre de la vue a des boutons pour nouvelle connexion, actualiser, importer, paramètres, le guide et **tout réduire**.

## La connexion utilisée
La connexion *active* est celle liée à l'éditeur de requêtes où vous êtes, ou la dernière qui a exécuté quelque chose. La barre d'état l'affiche sous la forme `[ENV] nom · base de données` ; cliquez dessus pour changer la connexion de l'éditeur courant.

## Un compte en lecture seule pour la garantie côté serveur
Marquer une connexion en lecture seule est appliqué par RizomaDB (et par le serveur quand le moteur le permet). Pour une garantie qui ne dépend d'aucun client, donnez à la connexion un compte de base de données qui ne peut que lire. Faites un clic droit sur la connexion et choisissez **Générer un script d'utilisateur en lecture seule…** : vous choisissez le nom du compte et RizomaDB ouvre un script dans un éditeur. Il ne l'exécute jamais et n'écrit jamais de mot de passe : remplacez le marqueur `<choose-a-password>` et exécutez-le avec un compte administrateur. Disponible pour PostgreSQL, MySQL/MariaDB, ClickHouse et Redis/Valkey ; chaque script a été exécuté sur un vrai serveur et l'on a vérifié que le nouveau compte lit et se voit refuser les écritures (les autres moteurs le disent au lieu de deviner).

## Importer depuis d'autres outils
**RizomaDB : Importer des connexions depuis d'autres outils…** lit les chaînes de connexion, `~/.pgpass`, `~/.my.cnf` et les fichiers DBeaver et SQLTools. Voir [Migrer](migration.md).

## Déplacer des connexions dans un fichier scellé
**Exporter les connexions (chiffrées)…** écrit vos connexions enregistrées dans un fichier `.rzcat` scellé par une phrase secrète de votre choix (AES-256-GCM, clé dérivée avec scrypt) ; **Importer les connexions (chiffrées)…** en lit un. Le fichier ne contient que des profils : les mots de passe restent dans le stockage de secrets de chacun et sont demandés à la première connexion. Une mauvaise phrase secrète ou un fichier modifié est rejeté en bloc, et les connexions dont l'id existe déjà sont ignorées. Vous pouvez envoyer le fichier par n'importe quel canal ; gardez la phrase secrète à part.

## Partager des connexions avec une équipe
Un fichier de catalogue (`.rizomadb/connections.json` dans le projet, ou le fichier indiqué dans `rizomadb.catalog.teamFile`) liste des connexions sans secrets ; chacun ajoute son propre mot de passe la première fois. Les entrées partagées sont en lecture seule dans l'interface.
