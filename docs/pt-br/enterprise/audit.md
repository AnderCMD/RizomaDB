# Trilha de auditoria

Cada instrução executada pelo RizomaDB é acrescentada a um arquivo JSONL local (por padrão, a pasta de armazenamento da extensão; `rizomadb.audit.path` a substitui). Nada é enviado para lugar nenhum.

Campos: `ts`, `user` (usuário do SO), `connection`, `environment`, `engine`, `kind` (SELECT/UPDATE/…), `statement`, `status` (`ok`, `error`, `blocked`, `cancelled`), `rows`, `durationMs`, `detail`.

* **Sem dados por padrão:** os literais de string, número e hexadecimais são substituídos por `?` (`rizomadb.audit.includeValues` os mantém). As instruções bloqueadas pela política também são registradas.
* **Rotação:** aos 5 MB o arquivo é renomeado para `audit-<timestamp>.jsonl`; os 5 mais recentes são mantidos.
* **Visualizador:** *RizomaDB: Abrir o log de auditoria* (filtro todas / bloqueadas / erros / bem-sucedidas). *Exportar o log de auditoria…* grava um arquivo JSONL para o seu SIEM.
* O arquivo é criado com modo 0600. É uma evidência local, não à prova de adulteração: encaminhe-o a um sistema de sua confiança se precisar disso.
