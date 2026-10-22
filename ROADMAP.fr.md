# Feuille de route

[English](ROADMAP.md) · [Español](ROADMAP.es.md) · [Português (Brasil)](ROADMAP.pt-br.md) · Français

L'état honnête de chaque phase et de ses portes de sortie figure dans la [liste d'acceptation](docs/release/v1-checklist.md) et le journal dans [docs/ai/STATE.md](docs/ai/STATE.md) (tous deux en espagnol).

## Avant la 1.0
- Le responsable décide quand publier (rien n'est encore publié sur le Marketplace, Open VSX ni npm).
- Relecture par des locuteurs natifs des textes en portugais (Brésil) et en français (voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md#relire-une-traduction)).
- Tests par d'autres personnes et avec de vrais comptes cloud (voir [Aidez à tester RizomaDB](docs/fr/guides/help-test.md)).
- Un audit d'accessibilité indépendant.
- Une première exécution du workflow de release, qui construit les paquets par plateforme et n'a jamais tourné.

## Non prévu
- Redshift, Snowflake et BigQuery : ils ne peuvent pas être testés sans comptes, et le projet n'affirme pas une prise en charge qu'il n'a pas testée.
- Un pont JDBC/ODBC et les moteurs de niveau 3.
