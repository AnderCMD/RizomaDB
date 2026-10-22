# Referência de configurações

Todas as configurações da extensão. Abra a tela de configurações com **RizomaDB: Abrir configurações** para alterá-las com um formulário; cada alteração é salva nas suas configurações de usuário ao ser feita. As configurações marcadas como *machine-overridable* também podem ser definidas por um administrador.

| Configuração | Tipo | Padrão | O que faz |
|---|---|---|---|
| `rizomadb.language` | string (`auto`, `en`, `es`, `pt`, `fr`) | `auto` | Idioma das telas e mensagens do RizomaDB: `auto` segue o idioma de exibição do VS Code, ou force `en`, `es`, `pt` (Português, Brasil) ou `fr`. Os nomes de comandos e configurações sempre seguem o VS Code. |
| `rizomadb.environments` | lista | `[]` | Ambientes extras além de dev, staging e prod, por exemplo `{ "name": "qa", "protection": "confirm" }`. Proteção: `none`, `confirm` (perguntar antes de cada gravação) ou `readOnly` (bloquear gravações). Você também pode adicionar um na tela Nova conexão. |
| `rizomadb.editor.codeLens` | boolean | `true` | Mostrar os botões Executar e Explicar acima de cada instrução nos editores de consulta, além de Executar tudo e da conexão em uso. |
| `rizomadb.editor.highlightStatement` | boolean | `true` | Destacar a instrução sob o cursor nos editores de consulta. |
| `rizomadb.explorer.groupByFamily` | boolean | `true` | Agrupar as conexões da árvore por tipo de motor (relacional, documento, chave-valor…). |
| `rizomadb.results.location` | string (`bottom`, `full`, `beside`) | `bottom` | Onde aparecem os resultados das consultas e as tabelas abertas: `bottom` (metade inferior sob o editor, padrão), `full` (toda a área do editor) ou `beside` (ao lado do editor). |
| `rizomadb.security.confirmDestructive` | boolean | `true` | Pedir confirmação antes de instruções destrutivas (DROP, TRUNCATE, UPDATE/DELETE sem WHERE). O bloqueio de somente leitura nunca é afetado por esta configuração. |
| `rizomadb.security.prodReadOnlyByDefault` | boolean | `true` | Tratar as conexões marcadas como `prod` como somente leitura. |
| `rizomadb.query.pageSize` | number | `1000` | Linhas carregadas por página de resultados. "Carregar mais" na visão de resultados busca a próxima página em todos os motores. |
| `rizomadb.query.keysetPaging` | boolean | `false` | Pagina as tabelas pela chave primária em vez de pular linhas. "Carregar mais" começa logo após a última linha, então continua rápido em tabelas grandes. Ao abrir uma tabela ela é ordenada pela chave. Apenas SQLite, PostgreSQL, MySQL, SQL Server e Oracle; os outros motores e as tabelas sem chave primária continuam pulando linhas. Uma ordenação própria no filtro também pula linhas. |
| `rizomadb.query.maxRows` | number | `100000` | Máximo de linhas mantidas em uma visão de resultados, somando todas as páginas carregadas. |
| `rizomadb.query.timeoutSeconds` | number | `0` | Tempo limite da consulta em segundos (0 = sem limite). |
| `rizomadb.history.enabled` | boolean | `true` | Registrar as instruções executadas em um arquivo de histórico local (os segredos são ocultados). |
| `rizomadb.history.retentionDays` | number | `90` | Dias para manter as entradas do histórico. |
| `rizomadb.edit.applyImmediately` | boolean | `false` | Salvar cada edição de célula assim que você a confirma, sem pressionar Aplicar. Em conexões `dev` é aplicada em silêncio; todos os outros ambientes ainda perguntam antes, e as políticas e regras de somente leitura sempre valem. |
| `rizomadb.table.openRows` | number | `200` | Linhas carregadas ao abrir uma tabela. |
| `rizomadb.policy.team` | object | `{}` | Camada de política da equipe (mesmo formato de `.rizomadb/policy.json`). Distribua-a por configurações gerenciadas do VS Code; as camadas de projeto e de usuário só podem torná-la mais rígida. |
| `rizomadb.catalog.teamFile` | string | *(vazio)* | Caminho de um arquivo de catálogo de conexões compartilhadas (sem segredos). |
| `rizomadb.audit.enabled` | boolean | `true` | Gravar uma trilha de auditoria local de cada instrução (os literais são removidos). |
| `rizomadb.audit.path` | string | *(vazio)* | Caminho do arquivo de auditoria (padrão: a pasta de armazenamento da extensão). |
| `rizomadb.audit.includeValues` | boolean | `false` | Manter os valores literais nas entradas de auditoria. Desativado por padrão, para que o log não guarde dados. |
| `rizomadb.mcp.autoRegister` | boolean | `false` | Oferecer o servidor MCP somente leitura do RizomaDB ao cliente MCP do VS Code quando uma pasta tiver `.rizomadb/mcp.json` (criado por *RizomaDB: Gerar a configuração do MCP*). Desativado por padrão; a senha do banco de dados é pedida quando o servidor inicia. |
| `rizomadb.ai.enabled` | boolean | `false` | Ativar a assistência de IA. Desativada por padrão: nada é enviado a lugar nenhum até você ativá-la e confirmar cada solicitação remota. |
| `rizomadb.ai.provider` | string (`openai-compatible`, `anthropic`) | `openai-compatible` | Estilo da API: `openai-compatible` (Ollama, LM Studio, OpenAI, …) ou `anthropic`. |
| `rizomadb.ai.endpoint` | string | `http://localhost:11434/v1` | URL base da API do modelo. Endpoints locais (localhost) não enviam nada para fora da sua máquina. |
| `rizomadb.ai.model` | string | `llama3.1` | Nome do modelo a solicitar. |
| `rizomadb.ai.redactLiterals` | boolean | `true` | Substituir os valores literais do seu SQL por `?` antes de incluí-lo em uma solicitação. |

*Gerado por `scripts/gen-reference.mjs` a partir do manifesto da extensão; não edite à mão.*
