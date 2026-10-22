# Matrice des capacités par moteur

Ce que chaque moteur prend en charge, lu dans les capacités déclarées par les pilotes et les règles de l'extension. Un tiret signifie *non pris en charge* ; ce n'est jamais une promesse d'ajout. Les moteurs testés contre un vrai serveur figurent sur la page de chaque moteur.

| Moteur | Famille | Langage de requête | Modifier les lignes dans la grille | Annuler | Lecture seule imposée par | Zone de filtre de la table | Modification des colonnes | Plan d'exécution | Outils d'administration |
|---|---|---|---|---|---|---|---|---|---|
| PostgreSQL | relationnel | sql | par clé primaire | oui | le serveur | WHERE / ORDER BY | oui | oui | oui |
| MySQL / MariaDB | relationnel | sql | par clé primaire | oui | le serveur | WHERE / ORDER BY | oui | oui | oui |
| SQLite | relationnel | sql | par clé primaire | — | le serveur | WHERE / ORDER BY | oui | oui | — |
| SQL Server | relationnel | sql | par clé primaire | oui | RizomaDB (client) | WHERE / ORDER BY | oui | oui | oui |
| Oracle Database | relationnel | sql | par clé primaire | oui | RizomaDB (client) | WHERE / ORDER BY | oui | oui | oui |
| ClickHouse | relationnel | sql | — | oui | le serveur | WHERE / ORDER BY | — | oui | — |
| DuckDB | relationnel | sql | par clé primaire | oui | RizomaDB (client) | WHERE / ORDER BY | — | oui | — |
| Trino | relationnel | sql | — | oui | RizomaDB (client) | WHERE / ORDER BY | — | oui | — |
| MongoDB | documents | mongo | par id de document | oui | RizomaDB (client) | filtre / tri (JSON) | — | oui | — |
| Redis / Valkey | clé-valeur | redis | par clé | oui | RizomaDB (client) | — | — | — | — |
| Elasticsearch / OpenSearch | recherche | json | — | oui | RizomaDB (client) | texte de recherche / tri | — | oui | — |
| Neo4j | graphes | cypher | — | oui | RizomaDB (client) | condition / ORDER BY | — | — | — |
| HydraDB (experimental) | graphes | cypher | — | oui | RizomaDB (client) | — | — | — | — |
| Amazon DynamoDB | clé-valeur | sql | — | oui | RizomaDB (client) | — | — | — | — |
| Google Cloud Firestore | documents | json | — | oui | RizomaDB (client) | — | — | — | — |
| InfluxDB 2.x | séries temporelles | flux | — | oui | RizomaDB (client) | — | — | — | — |
| InfluxDB 3 | séries temporelles | sql | — | oui | le serveur | — | — | oui | — |
| Apache Cassandra / ScyllaDB | colonnes larges | cql | — | oui | RizomaDB (client) | — | — | — | — |

## Notes

- **Zone de filtre de la table** : la barre sous la ligne de requête à l'ouverture d'une table ; elle modifie l'instruction dans la base, donc la pagination et la modification continuent de fonctionner.
- **Modification des colonnes** : renommer, changer le type, NOT NULL, valeur par défaut, ajouter et supprimer depuis le menu de la colonne ; elles montrent le DDL exact et demandent confirmation.
- **Lecture seule imposée par le serveur** signifie que la connexion elle-même refuse les écritures ; par RizomaDB (client) signifie qu'un classificateur d'instructions qui refuse par défaut s'en charge, donc pour une garantie ferme utilisez aussi un rôle de base de données en lecture seule.

*Généré par `scripts/gen-reference.mjs` à partir du manifeste de l'extension ; ne pas modifier à la main.*
