# Comparaison honnête

Fondée sur `competitive-analysis.md` (vérifié le 2026-10-20, en anglais) et sur ce que RizomaDB réussit réellement dans ses propres tests. « Non vérifié » signifie que nous ne l'avons pas confirmé auprès d'une source primaire. Mise à jour le 2026-10-22.

| | RizomaDB (ce dépôt) | DBCode | Database Client | SQLTools |
|---|---|---|---|---|
| Licence | Apache-2.0, tout le code ouvert | Produit propriétaire | Les nouvelles versions sont fermées | MIT |
| Offres payantes | Aucune | Pro/Team | Non vérifié | Aucune |
| Télémétrie | Aucune ; garantie par un test de zéro socket | Anonyme (suit le paramètre de VS Code) | Anonyme, avec sa propre désactivation | Non trouvée |
| Maturité | Pré-1.0, jamais publié, pas testé par de vrais utilisateurs | Très utilisé | Très utilisé | Très utilisé |
| Moteurs avec tests contre un vrai moteur | 18 pilotes couvrant 24 moteurs : SQLite, PostgreSQL (+CockroachDB, YugabyteDB), MySQL/MariaDB (+TiDB), SQL Server, Oracle, MongoDB, Redis/Valkey, ClickHouse, Elasticsearch/OpenSearch, DuckDB, Neo4j, DynamoDB Local, InfluxDB 2 et 3, Cassandra/ScyllaDB, émulateur Firestore, Trino, HydraDB (expérimental) | « 90+ » selon leur liste | Voir leur liste | Beaucoup via des pilotes |

## Là où RizomaDB n'est pas (encore) compétitif
- **Étendue** : moins de moteurs que la liste de DBCode ; les comptes cloud réels (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gérés) n'ont jamais été testés ; Redshift, Snowflake et BigQuery ne sont pas implémentés ; les moteurs de niveau 3 et un pont JDBC/ODBC n'existent pas.
- **Peu de tests humains jusqu'ici** : le test automatique de bout en bout l'active dans un vrai VS Code et vérifie les commandes et les lentilles de l'éditeur, les écrans réussissent axe en clair et en sombre, et le responsable a fait une revue manuelle avec un lecteur d'écran sur macOS, Windows et Linux sans trouver de problème ; il n'y a pas d'audit d'accessibilité indépendant.
- **Non publié** : pas de fiche sur le Marketplace ni sur Open VSX, et le workflow de release (sommes de contrôle, SBOM, provenance de build) n'a jamais tourné.
- **DuckDB** a besoin d'un module natif propre à la plateforme : il n'est fourni que dans les fichiers VSIX par plateforme, construits par le workflow de release (seuls deux sur six ont été exécutés).
- Communauté : aucune pour l'instant. Les textes en portugais et en français ont été écrits avec l'aide d'une IA et n'ont pas été relus par des locuteurs natifs.
- Certaines fonctions sont jeunes : HydraDB est expérimental ; la pagination fonctionne sur tous les moteurs en réexécutant la requête et en sautant des lignes, ce qui est plus lent pour les pages très profondes qu'un curseur natif (un paramètre optionnel pagine par clé primaire sur cinq moteurs SQL).

## Là où il diffère par conception
Licence vérifiable et zéro télémétrie ; un point unique de politique et d'audit pour tout chemin d'écriture ; des contrôles d'entreprise (politique en couches, environnements personnalisés avec protection, masquage, audit) sans offre payante ; modification sur place avec des changements en attente appliqués en une transaction et détection des conflits ; un assistant d'IA facultatif avec le schéma seulement et un serveur MCP facultatif en lecture seule avec des garde-fous ; et un guide interactif plus une interface en anglais, espagnol, portugais (Brésil) et français, commutables dans l'extension.
