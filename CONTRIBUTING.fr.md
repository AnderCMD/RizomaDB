# Contribuer

[English](CONTRIBUTING.md) · [Español](CONTRIBUTING.es.md) · [Português (Brasil)](CONTRIBUTING.pt-br.md) · Français

1. `pnpm install`. Démarrez les moteurs dont vous avez besoin pour les tests : `docker compose -f test/compose/docker-compose.yml up -d <moteur>`.
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` doit réussir. Les suites des moteurs sont ignorées quand leur moteur est arrêté en local et échouent en CI. Pour l'extension, lancez aussi `pnpm --filter rizomadb test:e2e` (un vrai VS Code).
3. Branches : travaillez sur une branche et ouvrez une pull request vers **`dev`** ; `dev` est promue vers **`main`** par une pull request (le workflow *Promote dev to main* l'ouvre). Voir [docs/fr/ci-cd.md](docs/fr/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). Pas de télémétrie, pas de secrets en dehors de SecretStorage, pas de `TODO` dans le code terminé.
5. Tout nouveau pilote doit réussir `runConformance` de `@rizomadb/driver-api/conformance`, ajouter une page de moteur dans `docs/engines/` et apparaître dans `scripts/gen-reference.mjs`.
6. Le texte visible par l'utilisateur passe par `t()` (hôte) ou par la table de textes du webview, avec des traductions dans `apps/extension/l10n/bundle.l10n.es.json`, `bundle.l10n.pt-br.json` et `bundle.l10n.fr.json` (et `package.nls.*.json` pour le texte du manifeste) ; un test échoue s'il en manque une.
7. Après avoir modifié des paramètres ou des commandes, lancez `node scripts/gen-reference.mjs` pour actualiser les pages de référence (le CI vérifie qu'elles sont à jour).
8. La documentation existe en anglais, espagnol, portugais (Brésil) et français. Quand vous modifiez une page de `docs/`, mettez à jour ses équivalents dans `docs/es/`, `docs/pt-br/` et `docs/fr/` (ou indiquez dans la pull request lesquels manquent encore). `node scripts/check-docs-parity.mjs` liste les pages manquantes.
9. Décisions techniques importantes : ajoutez un ADR dans `docs/adr/`.

Licence des contributions : Apache-2.0.

Agents d'IA : lisez d'abord [AGENTS.md](AGENTS.md) (en anglais) ; le travail sur l'interface suit le [guide de conception](docs/design/design-guide.md) (en anglais). `graphify-out/GRAPH_REPORT.md` est une carte du code.

## Relire une traduction
Les textes en portugais (Brésil) et en français ont été écrits avec l'aide d'une IA et attendent la relecture de locuteurs natifs. `node scripts/export-translations.mjs` écrit `translation-review/pt-br.csv` et `fr.csv` (anglais, texte actuel et une colonne « corrected » vide ; les marqueurs comme `{0}` doivent rester). Envoyez les corrections sous forme de pull request modifiant `apps/extension/l10n/bundle.l10n.<langue>.json` et `apps/extension/package.nls.<langue>.json`, ou sous forme du CSV rempli dans un issue. Les pages de documentation de `docs/pt-br/` et `docs/fr/` peuvent être corrigées de la même façon, directement dans le Markdown.
