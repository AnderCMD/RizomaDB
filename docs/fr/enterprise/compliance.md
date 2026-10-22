# Traitement des données et notes de conformité

## Ce que RizomaDB touche et stocke
| Donnée | Où | Notes |
|---|---|---|
| Mots de passe, jetons, phrases secrètes SSH | SecretStorage de VS Code uniquement | jamais dans les paramètres, l'historique, les journaux ni les catalogues |
| Profils de connexion | état global de VS Code | sans secrets |
| Historique des requêtes | `history.jsonl` dans le stockage de l'extension | SQL masqué pour `password=…` ; rétention `rizomadb.history.retentionDays` |
| Piste d'audit | JSONL local | littéraux supprimés par défaut |
| Résultats des requêtes | mémoire uniquement (grille) | plafond de lignes `rizomadb.query.maxRows` ; les exports vont là où l'utilisateur les enregistre |
| Known hosts SSH | stockage de l'extension + `~/.ssh/known_hosts` | les hôtes inconnus ne sont jamais approuvés automatiquement |

Aucune donnée n'est envoyée au projet ni à un tiers. L'assistant d'IA facultatif est **désactivé par défaut** (`rizomadb.ai.enabled`) ; quand vous l'activez, une requête ne va qu'au point d'accès que vous configurez (un modèle local comme Ollama, ou un fournisseur de votre choix), uniquement après que vous avez confirmé ce qui sera envoyé, et les littéraux peuvent d'abord être masqués (`rizomadb.ai.redactLiterals`). Rien n'est envoyé sans cette confirmation, et `disable: ["ai"]` dans une politique désactive la fonction pour tout le monde.

## Matrice des contrôles
| Contrôle | Mis en œuvre par | Preuve |
|---|---|---|
| Accès (moindre privilège) | connexions en lecture seule, `prod` en lecture seule par défaut, lecture seule côté serveur par moteur lorsque disponible | `policy-paths.test.ts`, tests de lecture seule de la conformité des pilotes |
| Maîtrise des changements | file de modifications avec le SQL exact, application transactionnelle, approbations, confirmations | `editing.test.ts` sur 5 moteurs |
| Journalisation | piste d'audit locale, tentatives bloquées incluses | `policy-engine.test.ts` |
| Minimisation des données | masquage dans la grille/les exports, audit sans littéraux | tests d'export/masque |
| Sécurité du transport | vérification TLS activée par défaut, épinglage des clés d'hôte SSH | tests de `network` |
| Chaîne d'approvisionnement | lockfile, audit des licences, SBOM CycloneDX, provenance, gitleaks, CodeQL (tous exécutés à chaque push dans le workflow de CI) | `.github/workflows` |

Cette matrice décrit le logiciel, pas la conformité d'une organisation : vous avez toujours besoin de votre propre évaluation des risques.
