# Modelo de ameaças (STRIDE) — rascunho inicial

Ativos: credenciais de bancos de dados, dados consultados, histórico e registro de auditoria, integridade dos dados gravados, cadeia de suprimentos.

| Ameaça | Categoria | Controle |
|---|---|---|
| Um segredo vai parar em configurações, logs ou histórico | Divulgação de informações | Somente SecretStorage; um redator central; testes |
| Um webview injeta mensagens | Adulteração / elevação de privilégios | CSP estrita, validação com zod nas duas pontas, localResourceRoots mínimos |
| SQL gerado com injeção | Adulteração | Escape de identificadores e literais, parâmetros, fuzzing |
| Um espaço de trabalho não confiável carrega conexões ou políticas | Elevação de privilégios | Workspace Trust: modo restrito |
| Escrita acidental em produção | Adulteração | Rótulos de ambiente, somente leitura no servidor e no cliente, uma fila revisável |
| MITM / TLS desativado | Falsificação de identidade | TLS verificado por padrão, aviso visível, impressões digitais SSH |
| Dependência comprometida | Adulteração | Lockfile, auditoria, SBOM, procedência |
| Vazamento por IA / MCP | Divulgação de informações | Desligado por padrão, somente esquema, confirmação, auditoria |
| Repúdio de operações | Repúdio | Registro de auditoria local em JSONL |
| DoS por resultados enormes | Negação de serviço | Limites de linhas e memória, streaming, workers |

Este documento é mantido vivo e revisado a cada fase.
