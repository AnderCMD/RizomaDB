# Política de dependências

* O mínimo de dependências necessário; cada uma precisa de um motivo (driver de banco de dados, SSH, validação de esquemas, formatador).
* As licenças devem estar na lista permitida de `scripts/license-audit.mjs` (verificado por `pnpm audit:licenses --check` no CI). A MPL-2.0 só é aceita para pacotes de terceiros sem modificações.
* As versões são fixadas exatamente e bloqueadas (`pnpm-lock.yaml`); o pnpm recusa pacotes mais novos que sua idade mínima de publicação.
* Nenhum driver ou cliente proprietário é incluído. As ferramentas externas (`pg_dump`, `mysqldump`, `mongodump`, …) são detectadas no `PATH` e executadas como processos separados.
* Evitam-se módulos nativos; o DuckDB é a exceção e, por isso, é incluído somente nos arquivos VSIX por plataforma, nunca no universal.
* Os PRs do Dependabot/Renovate devem passar no CI, incluindo a verificação de licenças; as vulnerabilidades classificadas como altas/críticas bloqueiam releases.
