# Premiers pas

Cette page vous mène de zéro à la modification d'une valeur dans une table. Le même parcours est intégré à l'extension : lancez **RizomaDB : Ouvrir le guide** (l'icône de livre dans la vue des connexions) et il vous guide pas à pas, avec des boutons qui réalisent chaque étape pour vous.

## 1. Installer
RizomaDB n'est pas encore publié sur une place de marché. Compilez l'extension et installez le fichier :

```bash
pnpm install
pnpm --filter rizomadb package          # crée apps/extension/rizomadb-<version>.vsix
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```

Il s'installe aussi dans VSCodium, Cursor et Windsurf (utilisez leur propre `--install-extension`). Rechargez ensuite la fenêtre.

## 2. Créer une connexion
1. Cliquez sur l'icône RizomaDB dans la barre d'activité, puis sur le bouton **+** (ou lancez **RizomaDB : Nouvelle connexion**).
2. Choisissez votre moteur grâce à son logo. Utilisez la zone de recherche si la liste est longue.
3. Le formulaire est déjà rempli avec les valeurs habituelles de ce moteur (hôte `localhost`, port par défaut, utilisateur courant). Ne changez que ce qui diffère, et ajoutez le mot de passe.
4. Choisissez l'**environnement** : `dev`, `staging`, `prod`, ou **Nouvel environnement…** pour le vôtre (par exemple `qa`). La production demande confirmation avant d'écrire ; voir [Connexions](connections.md).
5. **Tester la connexion** la vérifie sans l'enregistrer. **Enregistrer la connexion** la conserve. Si elle ne peut pas se connecter, vous pouvez quand même choisir **Enregistrer sans se connecter**.

## 3. Explorer
L'arborescence des connexions regroupe vos connexions par type (relationnel, documents, clé-valeur…) et affiche le logo de chaque moteur. Développez-en une pour voir ses tables (ou collections, clés, index…) et ses vues. La barre d'état en bas affiche la connexion utilisée et sa base de données.

## 4. Ouvrir une table
Cliquez sur une table. Les lignes s'ouvrent dans la moitié basse de la fenêtre. Les onglets au-dessus de la grille affichent **Données**, **Propriétés** (colonnes, types, index), **Relations** (clés étrangères dans les deux sens) et **DDL** (le script CREATE). Voir [La grille de résultats](results-grid.md).

## 5. Exécuter une requête
Lancez **RizomaDB : Nouvelle requête**, écrivez une instruction et appuyez sur **Ctrl+Entrée** (⌘+Entrée sur Mac). Chaque instruction reçoit aussi un bouton **Exécuter** au-dessus d'elle. Voir [L'éditeur de requêtes](query-editor.md).

## 6. Modifier une valeur
Dans une table qui a une clé primaire, double-cliquez sur une cellule (ou appuyez sur Entrée ou F2), saisissez, puis appuyez sur Entrée. Le changement attend comme *modification en attente* : relisez le SQL, puis appuyez sur **Appliquer**. La production et le staging demandent d'abord une confirmation. Voir [Modification des données](editing-data.md).

## 7. Faites-en votre outil
Lancez **RizomaDB : Ouvrir les paramètres** pour l'écran des paramètres : langue, lieu d'ouverture des résultats, lignes par page, environnements et plus. Voir [Langue et paramètres](language-and-settings.md).

## Bon à savoir
- Rien n'est envoyé nulle part. Il n'y a ni télémétrie ni compte. Les mots de passe et jetons vivent dans le stockage de secrets de VS Code, jamais dans un fichier de paramètres.
- Si quelque chose ne fonctionne pas comme prévu, voir [Dépannage](troubleshooting.md).
