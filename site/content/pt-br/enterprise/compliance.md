# Tratamento de dados e notas de conformidade

## O que o RizomaDB toca e guarda
| Dado | Onde | Notas |
|---|---|---|
| Senhas, tokens, frases secretas SSH | somente SecretStorage do VS Code | nunca em configurações, histórico, logs nem catálogos |
| Perfis de conexão | estado global do VS Code | sem segredos |
| Histórico de consultas | `history.jsonl` no armazenamento da extensão | SQL com `password=…` ocultado; retenção `rizomadb.history.retentionDays` |
| Trilha de auditoria | JSONL local | literais removidos por padrão |
| Resultados de consultas | somente memória (grade) | limite de linhas `rizomadb.query.maxRows`; as exportações vão para onde o usuário as salva |
| Known hosts do SSH | armazenamento da extensão + `~/.ssh/known_hosts` | hosts desconhecidos nunca são confiados automaticamente |

Nenhum dado é enviado ao projeto nem a terceiros. O assistente de IA opcional vem **desligado por padrão** (`rizomadb.ai.enabled`); quando você o liga, uma requisição vai somente ao endpoint que você configurar (um modelo local como o Ollama, ou um provedor de sua escolha), somente depois de você confirmar o que será enviado, e os literais podem ser ocultados antes (`rizomadb.ai.redactLiterals`). Nada é enviado sem essa confirmação, e `disable: ["ai"]` em uma política desliga o recurso para todos.

## Matriz de controles
| Controle | Implementado por | Evidência |
|---|---|---|
| Acesso (privilégio mínimo) | conexões somente leitura, `prod` somente leitura por padrão, somente leitura no servidor por motor quando disponível | `policy-paths.test.ts`, testes de somente leitura da conformidade dos drivers |
| Controle de mudanças | fila de edição com o SQL exato, aplicação transacional, aprovações, confirmações | `editing.test.ts` em 5 motores |
| Registro | trilha de auditoria local, tentativas bloqueadas incluídas | `policy-engine.test.ts` |
| Minimização de dados | mascaramento na grade/exportações, auditoria sem literais | testes de exportação/máscara |
| Segurança de transporte | verificação de TLS ativada por padrão, fixação de chave de host SSH | testes de `network` |
| Cadeia de suprimentos | lockfile, auditoria de licenças, SBOM CycloneDX, procedência, gitleaks, CodeQL (todos rodam a cada push no workflow de CI) | `.github/workflows` |

Esta matriz descreve o software, não a conformidade de uma organização: você ainda precisa da sua própria avaliação de riscos.
