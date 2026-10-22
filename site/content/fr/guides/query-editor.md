# L'éditeur de requêtes

**RizomaDB : Nouvelle requête** ouvre un éditeur dans le langage de la connexion : SQL, shell Mongo, commandes Redis, Cypher (Neo4j, HydraDB), requêtes REST pour Elasticsearch/OpenSearch et la console JSON de Firestore, ou Flux et CQL là où ces moteurs s'appliquent. Choisissez la connexion avec l'élément de la barre d'état ou la première lentille de l'éditeur.

## Construire une requête sans écrire de SQL
Faites un clic droit sur une connexion SQL et choisissez **Construire une requête…** : choisissez une table, les colonnes à afficher, un nombre quelconque de conditions (colonne, opérateur, valeur ; `IN` prend une liste séparée par des virgules), l'ordre et la limite de lignes. RizomaDB ouvre le `SELECT` obtenu dans un éditeur lié à cette connexion ; il ne l'exécute pas. Les valeurs deviennent des littéraux du type de la colonne (une valeur qui ne convient pas, comme du texte pour un nombre, est refusée), les noms sont entre guillemets par le pilote, et l'instruction a été vérifiée avec de vrais PostgreSQL et MySQL, y compris guillemets, barres obliques inverses et accents dans le texte. Les autres moteurs SQL utilisent le même code mais ne sont pas couverts par un test.

## Exécuter
| Action | Comment |
|---|---|
| Exécuter l'instruction sous le curseur | **Ctrl+Entrée** (⌘+Entrée), ou la lentille **Exécuter** au-dessus |
| Exécuter la sélection | **Ctrl+Maj+Entrée** (⌘+Maj+Entrée) |
| Exécuter toutes les instructions | Lentille **Tout exécuter (N)** en haut du fichier, ou **RizomaDB : Exécuter toutes les instructions** |
| Expliquer le plan (moteurs SQL qui le permettent) | Lentille **Expliquer**, ou **RizomaDB : Expliquer le plan de la requête** |
| Annuler | **RizomaDB : Annuler la requête en cours**, ou le bouton d'arrêt dans l'en-tête des résultats |

**Tout exécuter** exécute les instructions dans l'ordre et s'arrête à la première erreur. En dehors de `dev`, il demande d'abord confirmation, une seule fois pour tout le fichier. Chaque instruction passe quand même par la politique et le journal d'audit pour son propre compte.

### Instructions
- Le SQL est découpé sur les points-virgules de premier niveau (les chaînes, les commentaires et les dollar quotes de PostgreSQL sont compris). Cypher découpe aussi sur `;`.
- Le shell Mongo et la console des moteurs de recherche utilisent des **blocs séparés par des lignes vides** ; Redis utilise **une commande par ligne**. Les lignes de commentaire (`//`, `#`, `--`) sont ignorées.
- L'instruction sous le curseur est **surlignée** (`rizomadb.editor.highlightStatement`). Les lentilles peuvent être désactivées avec `rizomadb.editor.codeLens`.

### Paramètres
Les marqueurs comme `:nom`, `$1`, `@nom` ou `?` demandent leurs valeurs avant l'exécution. Les valeurs sont typées (`null`, `true`, nombres et `"texte entre guillemets"` ; tout le reste est du texte), liées par le pilote et mémorisées par connexion.

## Résultats
Les résultats s'ouvrent dans la moitié basse de la fenêtre (`rizomadb.results.location`). Chaque exécution remplace le même onglet ; **Épingler l'onglet des résultats** le conserve. L'onglet s'appelle `connexion.table` avec le logo du moteur. Voir [La grille de résultats](results-grid.md).

## Historique
**RizomaDB : Ouvrir l'historique des requêtes** ouvre un écran avec tout ce que vous avez exécuté, du plus récent au plus ancien, regroupé par jour. Recherchez dans le texte, filtrez par statut (toutes, réussies, en échec) ou par connexion et, pour chaque entrée, **ouvrez dans un éditeur**, **réexécutez** (si la connexion existe encore) ou **copiez**. L'étoile de chaque entrée l'ajoute à vos **favoris** (le filtre *Favorites*) : les favoris sont conservés à part de l'historique, donc **Effacer** et le réglage de rétention ne les suppriment jamais (retirez l'étoile pour en supprimer un). **Effacer** supprime l'historique. Les instructions et les erreurs sont stockées en local avec les secrets masqués ; `rizomadb.history.enabled` et `rizomadb.history.retentionDays` le contrôlent.

## Notebooks
**Nouveau notebook SQL** crée un notebook `.sqlnb` : des cellules SQL avec leurs résultats en dessous, enregistré en JSON simple.

## Sécurité
Chaque instruction est classée avant son exécution. Les lectures s'exécutent ; les écritures suivent l'environnement (confirmation, approbation, lecture seule) ; les instructions destructrices (`DROP`, `TRUNCATE`, `UPDATE`/`DELETE` sans `WHERE`…) demandent d'abord. La raison est affichée dans votre langue. Voir [Politiques](../enterprise/policy.md).
