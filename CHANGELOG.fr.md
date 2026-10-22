# Journal des modifications

[English](CHANGELOG.md) · [Español](CHANGELOG.es.md) · [Português (Brasil)](CHANGELOG.pt-br.md) · Français

Les changements notables sont listés ici, du plus récent au plus ancien. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/). Rien n'a encore été publié ; le journal du quotidien est dans [docs/ai/STATE.md](docs/ai/STATE.md) (en espagnol).

## [Non publié] — 0.0.1 (non publié)

### Ajouté
- Un client de bases de données multi-moteurs pour VS Code avec 24 moteurs, un éditeur SQL natif avec des boutons Exécuter, une grille de résultats modifiable avec des changements en attente appliqués en une transaction, un concepteur de tables, des diagrammes ER, l'import/export et des outils de schéma.
- Gouvernance : des politiques en couches où la plus stricte l'emporte, un point unique de politique et d'audit pour toute écriture, le masquage de colonnes, des catalogues partagés sans secrets et des fichiers de catalogue chiffrés.
- Pagination optionnelle des tables par clé primaire (SQLite, PostgreSQL, MySQL, SQL Server, Oracle), modification des entrées de streams Redis, profils AWS pour DynamoDB et fichiers d'identifiants Google pour Firestore.
- Un constructeur de requêtes sans SQL, un générateur d'utilisateurs en lecture seule, des favoris dans l'historique et l'export/import des paramètres.
- Des paquets par plateforme qui embarquent la bibliothèque native de DuckDB, et des étapes de release pour les sommes de contrôle, un SBOM et la provenance de build (pas encore exécutées).
- Interface et documentation en anglais, espagnol, portugais (Brésil) et français.

### Corrigé
- Abandonner un gros résultat ne bloque plus l'instruction suivante sur MySQL et SQL Server ; une annulation tardive ne touche plus l'instruction suivante sur MySQL, PostgreSQL et Oracle.
- Plusieurs problèmes de masquage, de contraintes par défaut de SQL Server et d'annulation dans HydraDB trouvés en testant avec de vrais serveurs.

### Non confirmé
- Les comptes cloud réels (AWS, Google Cloud, MongoDB Atlas, services gérés PostgreSQL/MySQL) n'ont jamais été testés. Redshift, Snowflake et BigQuery ne sont pas implémentés. Voir [docs/release/v1-checklist.md](docs/release/v1-checklist.md) (en espagnol).
