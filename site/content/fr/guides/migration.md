# Migrer vers RizomaDB

RizomaDB lit les définitions de connexion d'autres outils avec **RizomaDB : Importer des connexions depuis d'autres outils…**. Rien n'est envoyé nulle part ; les fichiers sont analysés en local.

| Source | Ce qui est importé | Ce qui n'est PAS importé |
|---|---|---|
| URI de connexion (`postgres://`, `mysql://`, `mongodb://`, `redis://`, ...) | hôte, port, base de données, utilisateur, indicateur TLS | — (le mot de passe de l'URI est proposé à SecretStorage, jamais écrit dans les paramètres) |
| `~/.pgpass` | hôte, port, base de données, utilisateur, mot de passe | Les entrées avec joker (`*`) sont ignorées |
| `~/.my.cnf` | hôte, port, utilisateur, mot de passe | Les groupes d'options autres que `client`/`mysql` |
| `data-sources.json` de DBeaver | nom, pilote, hôte, port, base de données | Noms d'utilisateur et mots de passe (DBeaver les chiffre ; saisissez-les à la première connexion) |
| `settings.json` de SQLTools (`sqltools.connections`) | nom, pilote, hôte, port, base de données, utilisateur | Les pilotes que RizomaDB n'implémente pas |

Les mots de passe trouvés en clair ne sont enregistrés qu'après votre confirmation, et uniquement dans SecretStorage de VS Code.

## Depuis Database Client (cweijan) et DBCode
Aucun format d'import n'est implémenté pour eux : le stockage de leurs connexions n'a pas été vérifié auprès de sources primaires, donc nous ne devinons pas. Utilisez l'importeur d'URI ou recréez les connexions avec l'assistant.

## Concepts qui diffèrent
- **Les modifications sont mises en file.** Les modifications de la grille deviennent un ensemble de changements en attente que vous relisez et appliquez en une transaction ; rien n'est écrit à la validation de la cellule.
- **Politique.** Les connexions `prod` sont en lecture seule par défaut ; changez cela dans le profil de connexion ou les fichiers de politique (`docs/enterprise/policy.md`).
- **Pas de télémétrie.** Il n'y a rien à désactiver.
