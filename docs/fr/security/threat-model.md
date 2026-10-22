# Modèle de menaces (STRIDE) — ébauche initiale

Actifs : identifiants de bases de données, données interrogées, historique et journal d'audit, intégrité des données écrites, chaîne d'approvisionnement.

| Menace | Catégorie | Contrôle |
|---|---|---|
| Un secret se retrouve dans les paramètres, les journaux ou l'historique | Divulgation d'informations | SecretStorage uniquement ; un masqueur central ; des tests |
| Un webview injecte des messages | Falsification / élévation de privilèges | CSP stricte, validation zod aux deux extrémités, localResourceRoots minimaux |
| SQL généré avec injection | Falsification | Échappement des identifiants et des littéraux, paramètres, fuzzing |
| Un espace de travail non fiable charge des connexions ou des politiques | Élévation de privilèges | Workspace Trust : mode restreint |
| Écriture accidentelle en production | Falsification | Étiquettes d'environnement, lecture seule côté serveur et client, une file relisible |
| MITM / TLS désactivé | Usurpation | TLS vérifié par défaut, avertissement visible, empreintes SSH |
| Dépendance compromise | Falsification | Lockfile, audit, SBOM, provenance |
| Fuite via l'IA / MCP | Divulgation d'informations | Désactivé par défaut, schéma uniquement, confirmation, audit |
| Répudiation d'opérations | Répudiation | Journal d'audit local en JSONL |
| DoS par des résultats énormes | Déni de service | Limites de lignes et de mémoire, streaming, workers |

Ce document est tenu à jour et relu à chaque phase.
