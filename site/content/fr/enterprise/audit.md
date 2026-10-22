# Piste d'audit

Chaque instruction exécutée via RizomaDB est ajoutée à un fichier JSONL local (par défaut le dossier de stockage de l'extension ; `rizomadb.audit.path` le remplace). Rien n'est envoyé nulle part.

Champs : `ts`, `user` (utilisateur du système), `connection`, `environment`, `engine`, `kind` (SELECT/UPDATE/…), `statement`, `status` (`ok`, `error`, `blocked`, `cancelled`), `rows`, `durationMs`, `detail`.

* **Pas de données par défaut :** les littéraux chaîne, nombre et hexadécimaux sont remplacés par `?` (`rizomadb.audit.includeValues` les conserve). Les instructions bloquées par la politique sont aussi journalisées.
* **Rotation :** à 5 Mo, le fichier est renommé `audit-<timestamp>.jsonl` ; les 5 derniers sont conservés.
* **Visionneuse :** *RizomaDB : Ouvrir le journal d'audit* (filtre toutes / bloquées / erreurs / réussies). *Exporter le journal d'audit…* écrit un fichier JSONL pour votre SIEM.
* Le fichier est créé en mode 0600. C'est une preuve locale, pas infalsifiable : transmettez-le à un système de confiance si vous en avez besoin.
