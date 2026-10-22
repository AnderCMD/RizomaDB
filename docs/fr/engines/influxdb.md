# InfluxDB 2.x

**Niveau :** 2 · **Versions testées :** InfluxDB 2.7.12 OSS (testée). InfluxDB 3 (SQL/InfluxQL), InfluxDB 1.x et InfluxDB Cloud ne sont **pas** pris en charge/testés.

## Authentification et transport
Jeton d'API (Authorization: Token …) via HTTP ou HTTPS, plus le nom de l'organisation. Créez un jeton en lecture seule pour un usage en lecture seule.

## Capacités
Éditeur Flux (fonctionne dans le mode de l'éditeur SQL), streaming de CSV annoté, colonnes typées (long, double, boolean, dateTime, base64Binary), buckets comme « schémas » et measurements comme « tables » avec les clés de tag/field dans l'explorateur. Non modifiable dans la grille.

## Notes sur les types
Les valeurs `dateTime` sont des `Date` ; les entiers 64 bits gardent leur précision. Des séries avec des ensembles de tags différents donnent des colonnes différentes : les 2000 premières lignes décident de l'ensemble de colonnes (les valeurs absentes sont nulles) ; les colonnes qui n'apparaissent que plus tard sont abandonnées avec un message. Utilisez `pivot()`/`keep()` pour contrôler la forme.

## Limites (en toute honnêteté)
- Pas de paramètres positionnels (Flux n'en a pas) : écrivez les littéraux dans le script.
- L'introspection parcourt toute la rétention (`start: 0`) et peut être lente sur de gros buckets.
- Pas d'écriture depuis la grille, pas d'import de line protocol, pas de gestion des tâches/alertes.
- Pas de visionneuse de plan.

## Application de la lecture seule
Côté client : les scripts qui utilisent `to()`, des tâches, ou des paquets qui sortent d'InfluxDB (http, sql, mqtt, secrets, notification endpoints) sont rejetés sur une connexion en lecture seule. Pour une garantie côté serveur, utilisez un jeton en lecture seule.

## Outils externes
aucun

## Licence du pilote
aucune (construit sur node:http)

## Lancer les tests d'intégration
`docker compose -f test/compose/docker-compose.yml up -d influxdb` puis `pnpm --filter @rizomadb/driver-influxdb test` (port 18086, modifiable avec `RZ_INFLUXDB_PORT` ; l'organisation/le jeton de test sont dans le fichier compose).
