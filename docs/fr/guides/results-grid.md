# La grille de résultats

L'ouverture d'une table ou l'exécution d'une requête affiche les lignes dans une grille conçue pour explorer. Chaque bouton est une icône avec une étiquette au survol ou à la prise de focus.

## Anatomie
1. **En-tête** : la connexion (logo, nom, environnement), la table et un état comme `1 000 lignes · 12 ms · d'autres lignes disponibles`.
2. **Onglets** (uniquement pour les tables) : **Données**, **Propriétés**, **Relations**, **DDL**.
3. **Ligne de requête** : l'instruction qui a produit les lignes. **Elle est modifiable.**
4. **Barre de filtre** (tables des moteurs pris en charge) : filtre et trie dans la base de données.
5. **Barre d'outils** : rechercher, filtres par colonne, afficher/masquer des colonnes, panneau d'enregistrement, lignes compactes, copier, enregistrer, réexécuter, raccourcis.
6. **Barre de modification** (résultats modifiables) : modifier, ajouter une ligne, supprimer, annuler, rétablir, relire le SQL, abandonner, **Appliquer**.
7. **Grille**, puis un **pied de page** avec le nombre de lignes, la durée et les statistiques de la colonne sélectionnée.

## La ligne de requête
Modifiez le texte et appuyez sur le bouton de lecture ou sur **Ctrl/⌘+Entrée** pour l'exécuter ; **Échap** remet l'original. Le texte modifié est une **nouvelle requête** : elle ne dit plus quelle table elle affiche, donc son résultat est en lecture seule. Si des modifications sont en attente, on vous demande avant de les abandonner. Le texte inchangé réexécute simplement la vue de la table. Les deux autres boutons copient la requête ou l'ouvrent dans un éditeur normal.

## Filtrer dans la base de données
Pour les tables, une barre sous la ligne de requête modifie l'instruction elle-même, donc la pagination et la modification continuent de fonctionner :

| Moteur | Zone de filtre | Zone de tri |
|---|---|---|
| Moteurs SQL | une condition : `age > 30 AND city = 'Lima'` | `name DESC` |
| MongoDB | une requête Mongo : `{ "status": "A" }` | un tri : `{ "total": -1 }` |
| Elasticsearch / OpenSearch | un texte de recherche : `level:error` | `timestamp:desc` |
| Neo4j | une condition sur `n` : `n.age > 30` | `n.name` |

Appuyez sur Entrée (ou sur le bouton de validation) pour appliquer et sur **Échap** (ou la croix) pour effacer. Le texte est placé dans une instruction par une seule fonction vérifiée : `;`, commentaires et parenthèses non appariées sont refusés, et l'instruction passe quand même par la politique. C'est différent de l'**entonnoir de la barre d'outils**, qui ne filtre que les lignes déjà chargées.

## Travailler avec les colonnes
Cliquez sur le nom d'une colonne pour **trier** (croissant, décroissant, aucun). Faites glisser le bord pour **redimensionner** (un double-clic ajuste au contenu). Le menu **⋮** d'un en-tête, ou un clic droit dessus, propose : trier, effacer le tri, filtrer cette colonne, ajuster la largeur, masquer, **statistiques de la colonne…**, copier le nom, copier les valeurs. Les *statistiques de la colonne* ouvrent un petit panneau avec le nombre de valeurs, de nulls et de valeurs distinctes, le minimum et le maximum (plus la moyenne et la somme pour les nombres) et un diagramme en barres : les valeurs les plus fréquentes, ou un histogramme pour une colonne numérique avec beaucoup de valeurs distinctes. Il est calculé sur les lignes affichées dans la grille (les filtres s'appliquent), pas sur toute la table. Les colonnes masquées reviennent avec le bouton des colonnes. Les largeurs et les colonnes masquées sont mémorisées par forme de résultat.

Pour les tables SQL, le même menu peut modifier la structure : **Renommer la colonne…**, **Changer le type…**, **Basculer NOT NULL**, **Définir la valeur par défaut…**, **Ajouter une colonne…**, **Supprimer la colonne…**. Chacune montre le SQL exact et demande confirmation ; les changements destructeurs sont signalés et les politiques s'appliquent. SQLite ne peut pas modifier certaines choses sur place et vous le dit.

## Cellules, lignes et panneau d'enregistrement
- Clic droit sur une cellule : copier, copier la ligne en JSON, filtrer par cette valeur, ouvrir le panneau d'enregistrement, modifier, mettre NULL, mettre une chaîne vide, supprimer la ligne.
- Cliquez sur le numéro à gauche d'une ligne pour la sélectionner ; Ctrl/⌘ bascule et Maj sélectionne une plage. **Tout sélectionner** est la case dans le coin.
- **Panneau d'enregistrement** (Alt+Entrée) : une ligne sous forme de formulaire, avec précédent/suivant, copier en JSON, boutons de copie et NULL par champ et mise en forme JSON.
- Les booléens affichent ✓/✗, les nombres sont alignés à droite, NULL et DEFAULT sont signalés, et la clé (🔑) et NOT NULL (*) sont signalés dans l'en-tête.

## Copier et enregistrer
Les boutons de copie et d'enregistrement exportent **ce que vous voyez** (colonnes visibles, ordre et filtre actuels) ou seulement les lignes sélectionnées, en **CSV, TSV, JSON ou Markdown**. Pour de très gros résultats, utilisez **Exporter les données…**, qui écrit dans un fichier en flux continu.

## Pagination
Une table s'ouvre avec une première page (`rizomadb.table.openRows`, 200) ; une requête commence avec `rizomadb.query.pageSize` (1000). S'il reste des lignes, le pied de page affiche **Charger N de plus** et **Tout charger** ; les nouvelles lignes sont ajoutées sans perdre votre tri, vos filtres ni votre sélection. `rizomadb.query.maxRows` (100 000) est le maximum de lignes conservées dans une vue ; au-delà, le pied de page vous dit d'affiner la requête ou d'exporter.

Comment cela fonctionne, honnêtement : la requête est réexécutée et les lignes déjà affichées sont sautées, ce qui marche sur **tous** les moteurs. La base de données refait le travail jusqu'à ce point, donc les pages très profondes sont plus lentes, et sans `ORDER BY` le moteur n'est pas obligé de renvoyer les lignes dans le même ordre deux fois. Pour un résultat stable sur une table qui change, triez-la. Si des modifications sont en attente, vous devez les appliquer ou les abandonner avant de charger plus.

Optionnel et désactivé par défaut : activez `rizomadb.query.keysetPaging` et la table s'ouvre triée par sa clé primaire, et *Charger plus* demande à la base de données les lignes **après** la dernière clé au lieu de sauter des lignes, donc les pages profondes restent aussi rapides que la première. C'est testé sur SQLite, PostgreSQL, MySQL, SQL Server et Oracle ; les autres moteurs, les tables sans clé primaire, les clés qui ne sont ni des nombres ni du texte et un tri personnalisé saisi dans la zone de filtre continuent de sauter des lignes. Comme la table est alors triée par sa clé, l'ordre des lignes diffère de l'ordre naturel du moteur.

## Où s'ouvrent les résultats
`rizomadb.results.location` : `bottom` (la moitié basse sous l'éditeur, par défaut), `full` (toute la zone de l'éditeur) ou `beside`.

## Raccourcis
| Touches | Action |
|---|---|
| Flèches, Début/Fin, Page préc./Page suiv. | Se déplacer entre les cellules |
| Maj + ↑/↓ | Étendre la sélection de lignes |
| Espace | Sélectionner ou désélectionner la ligne |
| Ctrl/⌘ + A | Sélectionner toutes les lignes |
| Entrée, F2, double-clic | Modifier la cellule |
| Suppr | Mettre NULL, ou supprimer les lignes sélectionnées |
| Ctrl/⌘ + Z / Y | Annuler / rétablir |
| Ctrl/⌘ + C | Copier la cellule ou les lignes sélectionnées |
| Ctrl/⌘ + F | Rechercher dans les résultats |
| Alt + Entrée | Panneau d'enregistrement |
| Maj + F10 | Menu contextuel |
| Échap | Effacer la sélection |

Le bouton clavier de la barre d'outils les liste dans l'application.
