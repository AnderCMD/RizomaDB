# Déploiement

## Réseau isolé / hors ligne
* L'extension ne fait **aucune connexion réseau de son propre chef** : pas de télémétrie, pas de vérification de mises à jour, pas de configuration distante. Un test (`apps/extension/src/activation.test.ts`) échoue si l'activation ouvre un socket ou si les sources de l'extension/du core importent des modules réseau.
* Installez depuis un VSIX (`code --install-extension rizomadb-x.y.z.vsix`) ou depuis un miroir interne d'Open VSX. Vérifiez le `SHA256SUMS` et l'attestation de provenance de build jointes à chaque release.
* Figez la version dans vos outils de gestion ; les mises à jour sont explicites.

## Installation en masse
* **Intune / GPO / Ansible :** distribuez le VSIX et exécutez `code --install-extension` par utilisateur, ou utilisez votre place de marché interne. Fournissez `rizomadb.policy.team` et `rizomadb.catalog.teamFile` via des paramètres VS Code gérés (portée machine).
* **Dev Containers / Codespaces :** ajoutez l'id de l'extension à `devcontainer.json` ; les connexions sont faites depuis le côté distant, donc la base de données doit être joignable depuis le conteneur.

## Proxys et certificats internes
* Les connexions aux bases de données peuvent passer par un tunnel SSH (bastion), un **proxy HTTP CONNECT** ou un **proxy SOCKS5**, choisi par connexion sous *Chemin réseau* (une connexion utilise un tunnel *ou* un proxy). Le code de proxy est testé contre de faux serveurs proxy locaux et, en CI, contre un vrai **Squid 6** (HTTP CONNECT, avec et sans authentification basique) et un vrai serveur SOCKS5 (`go-socks5-proxy`, utilisateur/mot de passe) atteignant un vrai PostgreSQL. Il n'a **pas** été testé avec Dante ou d'autres produits de proxy, ni avec des proxys exigeant NTLM/Kerberos.
* Les appels d'IA de l'extension elle-même (désactivés par défaut) et rien d'autre sont le seul trafic qui ne va pas vers une base de données que vous avez configurée.
* AC internes : PostgreSQL et MySQL acceptent un fichier d'AC par connexion (`sslCaFile`) ; pour tout le reste, définissez `NODE_EXTRA_CA_CERTS` pour VS Code. La vérification TLS est activée par défaut et la désactiver affiche un avertissement modal.

## Catalogues de connexions partagés
`.rizomadb/connections.json` (projet) et le fichier indiqué par `rizomadb.catalog.teamFile` (équipe) listent des connexions **sans secrets** ; chaque utilisateur se voit demander les `secretKeys` une fois et la réponse reste dans son propre SecretStorage de VS Code. Les entrées contenant des secrets en clair sont rejetées. Les couches suivantes remplacent les précédentes par `id`. Les entrées du catalogue ne peuvent être ni modifiées ni supprimées depuis l'interface.
```json
{ "version": 1, "connections": [ { "id": "orders-stg", "name": "Orders (staging)", "driver": "postgres", "environment": "staging", "options": { "host": "orders.stg.internal", "port": 5432, "database": "orders", "user": "app", "ssl": true }, "secretKeys": ["password"] } ] }
```
`${env:VAR}` et `${workspaceFolder}` sont développés dans les valeurs des options.

## Workspace Trust
Dans un espace de travail non fiable, la politique du projet, le catalogue du projet et les fichiers `.rizomadb` ne sont pas chargés ; les couches utilisateur et équipe continuent de s'appliquer.
