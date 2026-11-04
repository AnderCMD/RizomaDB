<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# CI/CD

Cómo viaja un cambio desde una rama hasta las personas usuarias, y qué es automático.

```
rama de funcionalidad ──PR──▶ dev ──PR (flujo Promote)──▶ main ──▶ sitio de documentación (GitHub Pages)
                                                            └──etiqueta v*──▶ flujo Release ──▶ (release de GitHub) ──▶ (la persona responsable aprueba `marketplace`) ──▶ Marketplace
```

| Flujo | Se ejecuta en | Qué hace |
|---|---|---|
| `ci.yml` | push y pull request a `main` o `dev` | lint, compilación, comprobación de tipos, auditoría de licencias, verificación de que las páginas de referencia generadas están al día, las suites de pruebas contra contenedores de motores reales (un segundo trabajo, `engines-extra`, levanta CockroachDB, YugabyteDB, InfluxDB 3, Firestore y HydraDB desde el archivo compose), benchmarks, compila el VSIX y lo conserva como artefacto (14 días), compila el sitio de documentación, compila y prueba el VSIX de linux-x64 (`platform-package`), busca secretos (gitleaks) y ejecuta CodeQL. Un push más reciente reemplaza una ejecución en curso. |
| `pages.yml` | push a `main` que toque `docs/`, `site/` o el flujo, o manual | compila el sitio VitePress (inglés y español) y lo despliega en GitHub Pages. |
| `promote.yml` | manual | abre el pull request `dev` → `main` si dev tiene commits que main no tiene. |
| `release.yml` | etiqueta `v*`, o manual | compila el VSIX universal y uno por plataforma (con la biblioteca nativa de DuckDB), comprueba su tamaño, genera el SBOM y las sumas de verificación, atestigua la procedencia y los adjunta al release de GitHub (las notas salen de `CHANGELOG.md`). Un segundo job, `marketplace`, publica después el VSIX **universal** en el Marketplace de VS Code con `vsce publish --oidc` (publicación de confianza: no se guarda ningún token ni PAT). Solo corre con una etiqueta y solo cuando la persona responsable aprueba el entorno `marketplace`. Los VSIX por plataforma (con DuckDB) quedan solo en el release de GitHub. |

No se publica nada en ningún marketplace ni registro sin que la persona responsable apruebe el entorno `marketplace`. Open VSX no está publicado.

## Ajustes del repositorio
Son ajustes del repositorio, no código, así que los flujos no los aplican. Aplicados el 2026-10-22:
- `main` y `dev` están protegidas: deben pasar las comprobaciones `test`, `engines-extra`, `site` y `secrets`, y se bloquean los force-push y los borrados. No se obliga a los administradores a pasar por pull requests, así que la persona responsable aún puede avanzar `main` desde `dev` con fast-forward.
- El token por defecto de los flujos es de solo lectura y Actions no puede aprobar pull requests.

No activado: permitir que GitHub Actions cree pull requests (Settings → Actions → General), que `promote.yml` necesita para abrir el pull request `dev` → `main`.

## Equivalentes locales
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, luego `node scripts/gen-reference.mjs --check` (o sin `--check` para refrescar las páginas de referencia), luego `pnpm --filter rizomadb-client package`. Para el sitio: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Los motores que necesitan contenedores se levantan con `docker compose -f test/compose/docker-compose.yml up -d <motor>`.

## Hacer un release
1. Sube `version` en `apps/extension/package.json` y añade una sección `## [x.y.z] — fecha` a `CHANGELOG.md` y `CHANGELOG.es.md` (las notas del release de GitHub salen del inglés).
2. Con el CI en verde en `main`, ponle la etiqueta: `git tag -a vX.Y.Z -m "RizomaDB X.Y.Z" && git push origin vX.Y.Z`. El flujo *Release* construye el VSIX universal y los seis por plataforma y los adjunta, con `SHA256SUMS`, el SBOM y la atestación de procedencia, al release de GitHub.
3. Descarga `rizomadb-X.Y.Z.vsix` del release y compruébalo (`shasum -a 256 -c SHA256SUMS --ignore-missing` y `gh attestation verify rizomadb-X.Y.Z.vsix --repo AnderCMD/RizomaDB`).
4. El flujo *Release* se detiene en el job `marketplace`: apruébalo en el cuadro *Review deployments* de la ejecución (o recházalo para dejar el release solo en GitHub). Una vez aprobado, el VSIX universal se sube al Marketplace; allí la verificación tarda unos minutos.

### Configuración única (ya hecha)
- Marketplace → publisher AnderCMD → *Trusted Publishing*: política `RizomaDB release`, proveedor GitHub Actions, propietario `AnderCMD`, repositorio `RizomaDB`, workflow `release.yml`, entorno `marketplace`.
- GitHub → Settings → Environments → `marketplace`: revisor obligatorio AnderCMD, despliegues limitados a las etiquetas `v*`.
- Sin probar todavía: ningún release ha ejecutado este job, así que el primero también es la primera prueba real del intercambio OIDC.

## Verificar un paquete de una versión
Cada VSIX de una versión viene con `SHA256SUMS`, un SBOM (`sbom.cdx.json`) y una atestación de procedencia de compilación de GitHub. Para comprobar una descarga:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
La atestación prueba qué ejecución del workflow construyó el archivo; no es un certificado de firma de código.
