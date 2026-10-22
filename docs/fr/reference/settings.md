# Référence des paramètres

Tous les paramètres de l'extension. Ouvrez l'écran des paramètres avec **RizomaDB : Ouvrir les paramètres** pour les modifier avec un formulaire ; chaque changement est enregistré dans vos paramètres utilisateur au moment où vous le faites. Les paramètres marqués *machine-overridable* peuvent aussi être fixés par un administrateur.

| Paramètre | Type | Par défaut | Ce que ça fait |
|---|---|---|---|
| `rizomadb.language` | string (`auto`, `en`, `es`, `pt`, `fr`) | `auto` | Langue des écrans et des messages de RizomaDB : `auto` suit la langue d'affichage de VS Code, ou forcez `en`, `es`, `pt` (Português, Brasil) ou `fr`. Les noms des commandes et des paramètres suivent toujours VS Code. |
| `rizomadb.environments` | liste | `[]` | Environnements supplémentaires en plus de dev, staging et prod, p. ex. `{ "name": "qa", "protection": "confirm" }`. Protection : `none`, `confirm` (demander avant chaque écriture) ou `readOnly` (bloquer les écritures). Vous pouvez aussi en ajouter un depuis l'écran Nouvelle connexion. |
| `rizomadb.editor.codeLens` | boolean | `true` | Afficher les boutons Exécuter et Expliquer au-dessus de chaque instruction dans les éditeurs de requêtes, ainsi que Tout exécuter et la connexion utilisée. |
| `rizomadb.editor.highlightStatement` | boolean | `true` | Mettre en évidence l'instruction sous le curseur dans les éditeurs de requêtes. |
| `rizomadb.explorer.groupByFamily` | boolean | `true` | Regrouper les connexions de l'arborescence par type de moteur (relationnel, document, clé-valeur…). |
| `rizomadb.results.location` | string (`bottom`, `full`, `beside`) | `bottom` | Où apparaissent les résultats des requêtes et les tables ouvertes : `bottom` (moitié inférieure sous l'éditeur, par défaut), `full` (toute la zone de l'éditeur) ou `beside` (à côté de l'éditeur). |
| `rizomadb.security.confirmDestructive` | boolean | `true` | Demander confirmation avant les instructions destructives (DROP, TRUNCATE, UPDATE/DELETE sans WHERE). Le blocage en lecture seule n'est jamais affecté par ce paramètre. |
| `rizomadb.security.prodReadOnlyByDefault` | boolean | `true` | Traiter les connexions étiquetées `prod` comme étant en lecture seule. |
| `rizomadb.query.pageSize` | number | `1000` | Lignes chargées par page de résultats. « Charger plus » dans la vue des résultats récupère la page suivante sur tous les moteurs. |
| `rizomadb.query.keysetPaging` | boolean | `false` | Pagine les tables par leur clé primaire au lieu de sauter des lignes. « Charger plus » commence juste après la dernière ligne, donc reste rapide sur les grandes tables. À l'ouverture, la table est triée par sa clé. SQLite, PostgreSQL, MySQL, SQL Server et Oracle uniquement ; les autres moteurs et les tables sans clé primaire continuent de sauter des lignes. Un tri personnalisé dans le filtre saute aussi des lignes. |
| `rizomadb.query.maxRows` | number | `100000` | Nombre maximal de lignes conservées dans une vue de résultats, toutes pages chargées confondues. |
| `rizomadb.query.timeoutSeconds` | number | `0` | Délai d'expiration de la requête en secondes (0 = aucun). |
| `rizomadb.history.enabled` | boolean | `true` | Enregistrer les instructions exécutées dans un fichier d'historique local (les secrets sont masqués). |
| `rizomadb.history.retentionDays` | number | `90` | Nombre de jours de conservation des entrées de l'historique. |
| `rizomadb.edit.applyImmediately` | boolean | `false` | Enregistrer chaque modification de cellule dès que vous la validez, sans appuyer sur Appliquer. Sur les connexions `dev`, elle s'applique silencieusement ; tous les autres environnements demandent d'abord, et les politiques et règles de lecture seule s'appliquent toujours. |
| `rizomadb.table.openRows` | number | `200` | Lignes chargées à l'ouverture d'une table. |
| `rizomadb.policy.team` | object | `{}` | Couche de politique d'équipe (même format que `.rizomadb/policy.json`). Déployez-la via les paramètres gérés de VS Code ; les couches projet et utilisateur ne peuvent que la renforcer. |
| `rizomadb.catalog.teamFile` | string | *(vide)* | Chemin d'un fichier de catalogue de connexions partagées (sans secrets). |
| `rizomadb.audit.enabled` | boolean | `true` | Écrire une piste d'audit locale de chaque instruction (les littéraux sont supprimés). |
| `rizomadb.audit.path` | string | *(vide)* | Chemin du fichier d'audit (par défaut : le dossier de stockage de l'extension). |
| `rizomadb.audit.includeValues` | boolean | `false` | Conserver les valeurs littérales dans les entrées d'audit. Désactivé par défaut pour que le journal ne contienne aucune donnée. |
| `rizomadb.mcp.autoRegister` | boolean | `false` | Proposer le serveur MCP RizomaDB en lecture seule au client MCP de VS Code lorsqu'un dossier contient `.rizomadb/mcp.json` (créé par *RizomaDB : Générer la configuration MCP*). Désactivé par défaut ; le mot de passe de la base est demandé au démarrage du serveur. |
| `rizomadb.ai.enabled` | boolean | `false` | Activer l'assistance IA. Désactivée par défaut : rien n'est envoyé nulle part tant que vous ne l'activez pas et ne confirmez pas chaque requête distante. |
| `rizomadb.ai.provider` | string (`openai-compatible`, `anthropic`) | `openai-compatible` | Style d'API : `openai-compatible` (Ollama, LM Studio, OpenAI, …) ou `anthropic`. |
| `rizomadb.ai.endpoint` | string | `http://localhost:11434/v1` | URL de base de l'API du modèle. Les points de terminaison locaux (localhost) n'envoient rien hors de votre machine. |
| `rizomadb.ai.model` | string | `llama3.1` | Nom du modèle à demander. |
| `rizomadb.ai.redactLiterals` | boolean | `true` | Remplacer les valeurs littérales de votre SQL par `?` avant de l'inclure dans une requête. |

*Généré par `scripts/gen-reference.mjs` à partir du manifeste de l'extension ; ne pas modifier à la main.*
