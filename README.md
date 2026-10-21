<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="420">
  </picture>
</p>

**Todas tus bases de datos, un solo lugar. Gratis.** · *All your databases, one place. Free.*

Cliente de bases de datos para VS Code: Apache-2.0, sin telemetría, sin cuentas, sin funciones bloqueadas.

> **Estado: Fase 1 (cimientos), pre-alfa.** La extensión aún no está publicada ni empaquetada.

## Qué existe hoy
| Componente | Estado |
|---|---|
| `driver-api` + kit de conformidad | Hecho |
| Driver SQLite (`node:sqlite`) | Hecho; sin cancelación mientras corra en el hilo principal |
| Driver PostgreSQL | Hecho; probado contra PostgreSQL 17 |
| `core` (perfiles, secretos, redacción, políticas) | Hecho |
| Extensión de VS Code (explorador, editor, rejilla) | Pendiente |

## Desarrollo
```bash
pnpm install
docker compose -f test/compose/docker-compose.yml up -d   # PostgreSQL para las pruebas
pnpm test
pnpm build:brand                                          # regenera el logotipo
```
Ver [docs/ai/STATE.md](docs/ai/STATE.md) y [docs/adr](docs/adr).
