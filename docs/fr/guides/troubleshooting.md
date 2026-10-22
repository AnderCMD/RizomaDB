# Dépannage

**Je ne peux pas modifier une cellule.** Seules les tables avec une clé primaire (ou les documents MongoDB, les clés Redis) ouvertes depuis l'arborescence sont modifiables. Les vues, les requêtes personnalisées, une ligne de requête que vous avez modifiée et les connexions en lecture seule ne le sont pas ; la grille explique quel cas s'applique. Vérifiez que la connexion n'est pas en lecture seule et que l'environnement n'est pas `prod` avec une protection en lecture seule.

**La connexion échoue sur localhost avec une erreur TLS.** Pour `localhost`, le formulaire décoche TLS par défaut. Si vous avez enregistré auparavant une connexion avec TLS activé, modifiez-la ou recréez-la. Les vrais serveurs ont généralement besoin de TLS ; voir la page du moteur.

**« Charger plus » n'apparaît jamais.** Il n'y a plus de lignes, ou la limite de lignes (`rizomadb.query.maxRows`) a été atteinte ; le pied de page dit laquelle. Les instructions qui ne sont pas des lectures ne renvoient pas de lignes à paginer.

**Les pages répètent ou sautent des lignes.** La pagination réexécute la requête et saute les lignes déjà affichées ; sans `ORDER BY`, le moteur peut donc renvoyer les lignes dans un autre ordre. Triez le résultat dans la requête ou dans la zone de tri.

**Un filtre est refusé.** Le texte ne peut pas contenir `;`, de commentaires ni de parenthèses non appariées. N'écrivez qu'une seule condition.

**L'arborescence n'affiche aucune table pour HydraDB.** HydraDB ne sait pas lister les étiquettes. Écrivez les étiquettes voulues dans le champ *Étiquettes à afficher dans l'arborescence* de la connexion.

**HydraDB répond « internal query execution error ».** Presque toujours un **ID de la cellule** erroné ; HydraDB ne sait pas lister les cellules, demandez donc à l'opérateur.

**Tout est en lecture seule après avoir modifié un fichier de politique.** Un fichier de politique illisible fait échouer toutes les écritures par précaution. Ouvrez le canal de sortie *RizomaDB policy* pour voir l'erreur.

**Un écran est dans la mauvaise langue.** Définissez `rizomadb.language` ; rouvrez les écrans ouverts. Les noms des commandes et des paramètres suivent la langue de VS Code.

Toujours bloqué ? Le canal de sortie *RizomaDB policy* et la barre d'état montrent ce qui bloque une action. Ouvrez un issue avec le moteur, la version et les étapes.
