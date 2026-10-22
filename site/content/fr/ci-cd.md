# CI/CD

Comment un changement voyage d'une branche jusqu'aux utilisateurs, et ce qui est automatique.

```
branche de fonctionnalité ──PR──▶ dev ──PR (workflow Promote)──▶ main ──▶ site de documentation (GitHub Pages)
                                                                    └──tag v*──▶ workflow Release ──▶ (approbation manuelle) places de marché
```

| Workflow | S'exécute sur | Ce qu'il fait |
|---|---|---|
| `ci.yml` | push et pull request vers `main` ou `dev` | lint, build, typecheck, audit des licences, une vérification que les pages de référence générées sont à jour, les suites de tests contre de vrais conteneurs de moteurs (un second job, `engines-extra`, démarre CockroachDB, YugabyteDB, InfluxDB 3, Firestore et HydraDB depuis le fichier compose), benchmarks, construit le VSIX et le conserve comme artefact (14 jours), construit le site de documentation, construit et teste le VSIX linux-x64 (`platform-package`), recherche des secrets (gitleaks) et exécute CodeQL. Un push plus récent remplace une exécution en cours. |
| `pages.yml` | push vers `main` touchant `docs/`, `site/` ou le workflow, ou manuel | construit le site VitePress (anglais, espagnol, portugais et français) et le déploie sur GitHub Pages. |
| `promote.yml` | manuel | ouvre la pull request `dev` → `main` si dev a des commits que main n'a pas. |
| `release.yml` | tag `v*`, ou manuel | construit le VSIX universel et un VSIX par plateforme (avec la bibliothèque native de DuckDB), vérifie leur taille, génère le SBOM et les sommes de contrôle, atteste la provenance et les joint à une préversion. **Publier sur le Marketplace et Open VSX est une étape distincte qui exige une approbation manuelle.** |

Rien n'est publié automatiquement sur une place de marché ou un registre.

## Paramètres du dépôt
Ce sont des paramètres du dépôt, pas du code, donc les workflows ne les appliquent pas. Appliqués le 2026-10-22 :
- `main` et `dev` sont protégées : les vérifications `test`, `engines-extra`, `site` et `secrets` doivent réussir, et les force-push et suppressions sont bloqués. Les administrateurs ne sont pas obligés de passer par des pull requests, donc le responsable peut encore avancer `main` depuis `dev` en fast-forward.
- L'environnement `marketplace` (utilisé par le job de release pour publier) exige un relecteur et n'accepte que les branches protégées.
- Le jeton par défaut des workflows est en lecture seule et Actions ne peut pas approuver de pull requests.

Non activé : autoriser GitHub Actions à créer des pull requests (Settings → Actions → General), dont `promote.yml` a besoin pour ouvrir la pull request `dev` → `main`.

## Équivalents locaux
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, puis `node scripts/gen-reference.mjs --check` (ou sans `--check` pour actualiser les pages de référence), puis `pnpm --filter rizomadb package`. Pour le site : `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Les moteurs qui ont besoin de conteneurs démarrent avec `docker compose -f test/compose/docker-compose.yml up -d <moteur>`.

## Vérifier un paquet de release
Chaque VSIX d'une release vient avec `SHA256SUMS`, un SBOM (`sbom.cdx.json`) et une attestation de provenance de build GitHub. Pour vérifier un téléchargement :

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
L'attestation prouve quelle exécution du workflow a construit le fichier ; ce n'est pas un certificat de signature de code. Ce chemin n'a pas encore été exécuté, car aucune release n'a été faite.
