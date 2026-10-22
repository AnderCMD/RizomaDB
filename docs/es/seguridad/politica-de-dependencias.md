# Política de dependencias

* Las dependencias mínimas necesarias; cada una necesita una razón (driver de base de datos, SSH, validación de esquemas, formateador).
* Las licencias deben estar en la lista permitida de `scripts/license-audit.mjs` (se verifica con `pnpm audit:licenses --check` en CI). MPL-2.0 solo se acepta para paquetes de terceros sin modificar.
* Las versiones se fijan exactamente y se bloquean (`pnpm-lock.yaml`); pnpm rechaza los paquetes más recientes que su antigüedad mínima de publicación.
* No se incluye ningún driver ni cliente propietario. Las herramientas externas (`pg_dump`, `mysqldump`, `mongodump`, …) se detectan en el `PATH` y se ejecutan como procesos separados.
* Se evitan los módulos nativos; DuckDB es la excepción y por eso solo se incluye en los VSIX por plataforma, nunca en el universal.
* Los PR de Dependabot/Renovate deben pasar el CI, incluida la comprobación de licencias; las vulnerabilidades altas o críticas bloquean las versiones.
