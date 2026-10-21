# Contribuir / Contributing

1. `pnpm install`; levanta PostgreSQL de pruebas: `docker compose -f test/compose/docker-compose.yml up -d`.
2. `pnpm build && pnpm typecheck && pnpm test` deben pasar.
3. Commits con Conventional Commits (`feat:`, `fix:`...). Sin telemetría, sin secretos fuera de SecretStorage, sin `TODO` en código terminado.
4. Cada driver nuevo debe pasar `runConformance` de `@rizomadb/driver-api/conformance`.
5. Decisiones técnicas importantes: añade un ADR en `docs/adr/`.
Licencia de contribuciones: Apache-2.0.
