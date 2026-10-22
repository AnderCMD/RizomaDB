# Politiques

RizomaDB fusionne des couches de politique et **le résultat le plus strict l'emporte toujours** : un fichier de projet peut resserrer ce que l'équipe a défini, un fichier utilisateur peut resserrer ce que le projet a défini, et personne ne peut assouplir ce qu'une couche supérieure a restreint.

| Couche | Où | Chargée quand |
|---|---|---|
| Intégrée | l'extension | toujours (`rizomadb.security.prodReadOnlyByDefault` ne peut désactiver que la lecture seule de `prod` par défaut de cette couche) |
| Équipe | paramètre VS Code `rizomadb.policy.team` (déployez-le comme paramètre géré/de machine) | toujours |
| Projet | `.rizomadb/policy.json` dans chaque dossier d'espace de travail | **espaces de travail de confiance uniquement** |
| Utilisateur | `policy.json` dans le stockage global de l'extension | toujours |

Un fichier de politique qui ne peut pas être lu ou validé met tout en lecture seule jusqu'à sa correction (échec par précaution) et affiche l'erreur dans le canal de sortie *RizomaDB policy*.

## Environnements personnalisés
Outre `dev`, `staging` et `prod`, on peut ajouter des environnements dans le formulaire de connexion (**Nouvel environnement…**) ou dans le paramètre `rizomadb.environments` : `{ "name": "qa", "protection": "confirm" }` où la protection est `none`, `confirm` (demander avant chaque écriture) ou `readOnly` (bloquer les écritures). Ils deviennent une couche de politique supplémentaire, donc ils ne peuvent qu'ajouter de la rigueur ; la section `environments` d'un fichier de politique ci-dessous peut décrire le même nom plus en détail et le résultat le plus strict l'emporte.

## Format (`version: 1`)
```json
{
  "version": 1,
  "defaults": { "maxRows": 100000 },
  "environments": {
    "prod": { "readOnly": true, "requireApproval": true, "timeoutSeconds": 30, "maxRows": 10000 },
    "staging": { "deny": ["drop", "truncate"], "confirmWrites": true },
    "qa": { "allow": ["select", "insert", "update"] }
  },
  "disable": ["ai", "backup", "restore"],
  "maskColumns": [{ "column": "/email|phone/i", "rule": "redact" }, { "column": "ssn", "rule": "last4" }]
}
```
* `readOnly` bloque toute écriture. `allow` (intersection entre les couches) et `deny` (union) restreignent les types d'instruction : `select insert update delete merge create alter drop truncate grant revoke execute`.
* `requireApproval` : l'utilisateur doit saisir le nom de la connexion avant l'exécution de tout changement.
* `confirmDestructive`, `confirmWrites` : demander avant les écritures destructrices / toutes les écritures. Une préférence utilisateur peut désactiver l'invite routinière de destruction, mais jamais une confirmation exigée par la politique.
* `maxRows`, `timeoutSeconds` : la plus petite valeur entre les couches s'applique à chaque requête.
* `disable` : désactive des commandes pour tout le monde (`ai`, `export`, `import`, `backup`, `restore`, `dataSync`, `designer`, `admin`).
* `maskColumns` : des noms ou `/regex/` ; règles `redact`, `nullify`, `hash`, `last4`. Les résultats masqués sont affichés masqués, ne peuvent pas être modifiés dans la grille et sont exportés masqués.

## Ce qui est garanti, et comment
Toutes les connexions remises aux fonctions sont enveloppées par une **connexion protégée** (`packages/core/src/guard.ts`) : une vérification de politique et une entrée d'audit par instruction, aussi bien pour l'éditeur, la grille, les imports, les outils de schéma, la synchronisation des données, les notebooks et les outils d'administration. `packages/data-tools/src/policy-paths.test.ts` exerce chacun de ces chemins contre une connexion `prod` et vérifie que les données ne changent pas.

Limites à connaître :
* La classification est **statique et refuse par défaut** (`assessStatement`) : une instruction n'est une lecture que si elle commence par un mot-clé de lecture connu et ne contient aucun mot-clé d'écriture ; tout ce qui n'est pas reconnu compte comme une écriture. Elle ne voit pas les effets de bord cachés dans des fonctions (`SELECT nextval(...)`, `SELECT pg_terminate_backend(...)`). Pour des garanties fermes, utilisez un compte de base de données avec des privilèges en lecture seule ; quand le moteur offre un mode lecture seule côté serveur, RizomaDB l'active aussi.
* La politique protège contre les erreurs et contre les fonctions de RizomaDB qui se comporteraient mal. Une personne avec ses propres identifiants de base de données et un autre client peut toujours écrire : ce n'est pas un remplacement des permissions de la base de données.
