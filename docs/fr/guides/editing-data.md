# Modification des données

## Ce qui peut être modifié
Un résultat est modifiable quand il provient de l'**ouverture d'une table** dont RizomaDB sait identifier les lignes :

| Moteur | Les lignes sont identifiées par |
|---|---|
| SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, DuckDB | la clé primaire |
| MongoDB | le `_id` du document |

Les vues, les requêtes personnalisées, les lignes de requête modifiées, les colonnes masquées, les connexions en lecture seule et les tables sans clé primaire **ne sont pas** modifiables ; quand vous essayez, la grille vous dit pourquoi. Tous les autres moteurs, y compris les clés Redis et Valkey, sont en lecture seule dans la grille (Redis a ses propres commandes pour supprimer, renommer et faire expirer des clés).

## Comment
1. **Double-cliquez** sur une cellule (ou sélectionnez-la et appuyez sur **Entrée** ou **F2**, ou utilisez le bouton crayon). Une boîte s'ouvre avec la valeur.
2. Saisissez, puis **Entrée** pour garder, **Échap** pour annuler. **Suppr** met NULL ; le menu du clic droit propose *Mettre NULL* et *Mettre une chaîne vide*.
3. **Ajouter une ligne** ajoute une ligne ; les cellules non renseignées affichent `DEFAULT`. Le bouton corbeille marque les lignes sélectionnées pour suppression (et les restaure). Annuler (Ctrl/⌘+Z) abandonne les lignes ajoutées.
   **Coller depuis un tableur :** sélectionnez une cellule et appuyez sur Ctrl/⌘+V. Les cellules séparées par des tabulations (ce que copient Excel, Numbers et Sheets) remplissent vers le bas et vers la droite à partir de la cellule sélectionnée, les cellules vides deviennent NULL et une valeur unique remplit toutes les lignes sélectionnées de cette colonne. Jusqu'à 5 000 cellules par collage ; c'est une seule étape d'annulation et, si une cellule n'est pas valide pour sa colonne, rien n'est appliqué.
4. Le pied de la barre de modification compte les **modifications en attente**. Les cellules modifiées sont surlignées, les lignes supprimées sont barrées.

Les valeurs sont vérifiées par rapport au type de la colonne pendant la saisie : une colonne entière refuse `abc`, les colonnes JSON doivent contenir du JSON valide et les colonnes binaires ne peuvent pas être modifiées ici.

## Relire et appliquer
- **Relire le SQL** ouvre les instructions exactes qui seraient exécutées (avec leurs paramètres), sans les exécuter.
- **Appliquer** envoie toutes les modifications **en une transaction** sur les moteurs qui ont des transactions. Sur les moteurs sans transactions (par exemple MongoDB), les modifications sont appliquées une à une, et le message dit combien étaient déjà appliquées si l'une échoue.
- La production et le staging demandent confirmation avant d'appliquer ; `requireApproval` vous demande de saisir le nom de la connexion. Les politiques, les connexions en lecture seule et le journal d'audit s'appliquent exactement comme pour l'éditeur.
- **Détection des conflits.** Chaque modification vérifie que la ligne a toujours les valeurs que vous avez vues ; si quelqu'un d'autre l'a modifiée ou supprimée, rien n'est appliqué et vous en êtes informé.
- **Abandonner** supprime tout ce qui est en attente.

## Enregistrer chaque modification immédiatement
Activez `rizomadb.edit.applyImmediately` si vous ne voulez pas d'étape Appliquer séparée. Chaque modification est appliquée dès que vous la validez. Seules les connexions `dev` sautent la confirmation ; tous les autres environnements demandent toujours, et les politiques et les règles de lecture seule s'appliquent toujours. Désactivé par défaut.

## Modifier la structure
Renommer, changer le type ou supprimer une colonne se fait dans le menu de la colonne (voir [La grille de résultats](results-grid.md#travailler-avec-les-colonnes)). Les nouvelles tables et les changements plus importants utilisent **Concevoir la table**, avec un aperçu du DDL avant toute exécution.
