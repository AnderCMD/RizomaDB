<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**Toutes vos bases de données, au même endroit. Gratuit.**

[English](README.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-br.md) · Français

Un client de bases de données multi-moteurs pour VS Code (et VSCodium, Cursor, Windsurf) : Apache-2.0, sans télémétrie, sans compte, sans fonctionnalité verrouillée. [Site de documentation](https://andercmd.github.io/RizomaDB/fr/)

> **Statut : pré-version.** Rien n'est encore publié sur le Marketplace, Open VSX ni npm, et la v1.0 **n'est pas** prête : voyez la [liste d'acceptation](docs/release/v1-checklist.md) (en espagnol), qui est honnête. L'extension se compile, s'installe et réussit ses tests contre de vrais moteurs, et le responsable du projet a fait une revue manuelle avec un lecteur d'écran sur macOS, Windows et Linux sans trouver de problème.

## Ce qu'il fait
- **Connectez-vous** à 24 moteurs depuis un écran de logos, avec l'hôte, le port et l'utilisateur habituels déjà remplis ; environnements (`dev`, `staging`, `prod` ou les vôtres) avec protection ; tunnels SSH et proxys HTTP/SOCKS5 ; secrets uniquement dans le stockage de secrets de VS Code. Les connexions sont regroupées par type dans l'arborescence, avec la connexion active et sa base de données dans la barre d'état.
- **Interrogez** dans le langage de chaque moteur, avec un bouton Exécuter au-dessus de chaque instruction, Tout exécuter, Expliquer, des paramètres, un écran d'historique avec recherche et des notebooks.
- **Explorez et modifiez** dans une grille conçue pour cela : trier, filtrer (dans les lignes ou dans la base), redimensionner, masquer, panneau d'enregistrement, copier/enregistrer en CSV/TSV/JSON/Markdown, pagination avec *Charger plus*, une ligne de requête modifiable et **modification des cellules sur place** avec des changements en attente que vous relisez et appliquez en une transaction. Renommez, changez le type ou supprimez une colonne depuis son menu.
- **Concevez et déplacez des données** : concepteur de tables, diagrammes ER, comparaison et documentation de schémas, import/export, sauvegarde et restauration, comparaison et synchronisation de données et génération de données de test.
- **Gouvernez** : des politiques en couches où la plus stricte l'emporte, un point unique de politique et d'audit pour toute écriture, masquage de colonnes, catalogues partagés sans secrets.
- **Extras optionnels** : un assistant d'IA (désactivé par défaut, schéma uniquement) et un serveur MCP en lecture seule avec des garde-fous.
- **Anglais, espagnol, portugais (Brésil) et français** (les deux derniers avec l'aide d'une IA, pas encore relus par des locuteurs natifs), commutables dans l'extension, et un **guide** interactif qui vous prend par la main.

## Moteurs
Testés contre de vrais serveurs : PostgreSQL (et CockroachDB, YugabyteDB), MySQL/MariaDB (et TiDB), SQL Server, Oracle, SQLite, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB (Local), InfluxDB 2 et 3, Cassandra/ScyllaDB, Firestore (émulateur), Trino et **HydraDB (expérimental)**. Ce que chacun prend en charge figure dans la [matrice des capacités](docs/fr/reference/engine-matrix.md) ; les limites sont sur la page de chaque moteur dans [docs/fr/engines](docs/fr/engines/README.md). **Non confirmé :** les comptes cloud réels (AWS, Google Cloud, MongoDB Atlas et services gérés PostgreSQL/MySQL) n'ont jamais été testés ; testez avec un utilisateur en lecture seule ou une base jetable avant de vous y fier. Redshift, Snowflake et BigQuery ne sont pas implémentés. Voir [Cloud et services gérés](docs/fr/engines/README.md#cloud-et-services-gérés-non-confirmés).

## Installer
```bash
pnpm install
pnpm --filter rizomadb package
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```
Cliquez ensuite sur l'icône RizomaDB, ou lancez **RizomaDB : Ouvrir le guide**. Parcours complet : [Premiers pas](docs/fr/guides/getting-started.md).

## Documentation
[Premiers pas](docs/fr/guides/getting-started.md) · [Connexions](docs/fr/guides/connections.md) · [L'éditeur de requêtes](docs/fr/guides/query-editor.md) · [La grille de résultats](docs/fr/guides/results-grid.md) · [Utiliser le clavier](docs/fr/guides/keyboard.md) · [Modification des données](docs/fr/guides/editing-data.md) · [Langue et paramètres](docs/fr/guides/language-and-settings.md) · [Dépannage](docs/fr/guides/troubleshooting.md) · [Aidez à tester](docs/fr/guides/help-test.md) · Référence des [paramètres](docs/fr/reference/settings.md) et des [commandes](docs/fr/reference/commands.md) · [Politiques](docs/fr/enterprise/policy.md) · [Modèle de menaces](docs/fr/security/threat-model.md) · [CI/CD](docs/fr/ci-cd.md) · [Guide de conception](docs/design/design-guide.md) (en anglais) · [AGENTS.md](AGENTS.md) (en anglais) · [Écrire un pilote](docs/fr/drivers/authoring.md)

## Développement
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d postgres   # ou le moteur que vous voulez tester
pnpm lint && pnpm build && pnpm typecheck && pnpm test
node scripts/gen-reference.mjs        # régénère les pages de référence des paramètres, commandes et moteurs
```
`dev` est la branche d'intégration et `main` est ce qui est déployé (le site de documentation) ; le CI tourne sur les deux. Voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md), [docs/fr/ci-cd.md](docs/fr/ci-cd.md), les registres de décision dans [docs/adr](docs/adr) et le journal dans [docs/ai/STATE.md](docs/ai/STATE.md).

## Licence
Apache-2.0. Licences tierces : [docs/legal/third-party-licenses.md](docs/legal/third-party-licenses.md). [Code de conduite](CODE_OF_CONDUCT.fr.md) · [Sécurité](SECURITY.fr.md) · [Journal des modifications](CHANGELOG.fr.md).
