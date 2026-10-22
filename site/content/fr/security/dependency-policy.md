# Politique de dépendances

* Le minimum de dépendances nécessaire ; chacune exige une raison (pilote de base de données, SSH, validation de schémas, formateur).
* Les licences doivent figurer dans la liste autorisée de `scripts/license-audit.mjs` (vérifié par `pnpm audit:licenses --check` en CI). La MPL-2.0 n'est acceptée que pour des paquets tiers non modifiés.
* Les versions sont figées exactement et verrouillées (`pnpm-lock.yaml`) ; pnpm refuse les paquets plus récents que son âge minimal de publication.
* Aucun pilote ni client propriétaire n'est embarqué. Les outils externes (`pg_dump`, `mysqldump`, `mongodump`, …) sont détectés dans le `PATH` et exécutés comme processus séparés.
* Les modules natifs sont évités ; DuckDB est l'exception et n'est donc fourni que dans les fichiers VSIX par plateforme, jamais dans l'universel.
* Les PR de Dependabot/Renovate doivent réussir le CI, y compris la vérification des licences ; les vulnérabilités classées hautes/critiques bloquent les releases.
