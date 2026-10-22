# Políticas

O RizomaDB combina camadas de política e **o resultado mais restritivo sempre vence**: um arquivo de projeto pode restringir o que a equipe definiu, um arquivo de usuário pode restringir o que o projeto definiu, e ninguém pode afrouxar o que uma camada superior restringiu.

| Camada | Onde | Quando é carregada |
|---|---|---|
| Integrada | a extensão | sempre (`rizomadb.security.prodReadOnlyByDefault` só pode desativar o padrão somente leitura de `prod` desta camada) |
| Equipe | configuração do VS Code `rizomadb.policy.team` (distribua-a como configuração gerenciada/de máquina) | sempre |
| Projeto | `.rizomadb/policy.json` em cada pasta do espaço de trabalho | **somente espaços de trabalho confiáveis** |
| Usuário | `policy.json` no armazenamento global da extensão | sempre |

Um arquivo de política que não pode ser lido ou validado deixa tudo somente leitura até ser corrigido (falha de forma segura) e mostra o erro no canal de saída *RizomaDB policy*.

## Ambientes personalizados
Além de `dev`, `staging` e `prod`, uma pessoa pode adicionar ambientes no formulário da conexão (**Novo ambiente…**) ou na configuração `rizomadb.environments`: `{ "name": "qa", "protection": "confirm" }`, em que a proteção é `none`, `confirm` (perguntar antes de cada gravação) ou `readOnly` (bloquear gravações). Eles se tornam uma camada de política extra, então só podem acrescentar rigor; a seção `environments` de um arquivo de política abaixo pode descrever o mesmo nome com mais detalhe e o resultado mais restritivo vence.

## Formato (`version: 1`)
```json
{
  "version": 1,
  "defaults": { "maxRows": 100000 },
  "environments": {
    "prod": { "readOnly": true, "requireApproval": true, "timeoutSeconds": 30, "maxRows": 10000 },
    "staging": { "deny": ["drop", "truncate"], "confirmWrites": true },
    "qa": { "allow": ["select", "insert", "update"] }
  },
  "disable": ["ai", "backup", "restore"],
  "maskColumns": [{ "column": "/email|phone/i", "rule": "redact" }, { "column": "ssn", "rule": "last4" }]
}
```
* `readOnly` bloqueia toda gravação. `allow` (interseção entre as camadas) e `deny` (união) restringem os tipos de instrução: `select insert update delete merge create alter drop truncate grant revoke execute`.
* `requireApproval`: o usuário deve digitar o nome da conexão antes de qualquer alteração ser executada.
* `confirmDestructive`, `confirmWrites`: perguntar antes das gravações destrutivas / de todas as gravações. Uma preferência do usuário pode desligar o aviso rotineiro de operações destrutivas, mas nunca uma confirmação que a política exige.
* `maxRows`, `timeoutSeconds`: o menor valor entre as camadas se aplica a toda consulta.
* `disable`: desliga comandos para todos (`ai`, `export`, `import`, `backup`, `restore`, `dataSync`, `designer`, `admin`).
* `maskColumns`: nomes ou `/regex/`; regras `redact`, `nullify`, `hash`, `last4`. Os resultados mascarados são mostrados mascarados, não podem ser editados na grade e são exportados mascarados.

## O que é garantido, e como
Todas as conexões entregues aos recursos são envolvidas por uma **conexão protegida** (`packages/core/src/guard.ts`): uma verificação de política e uma entrada de auditoria por instrução, igualmente para o editor, a grade, as importações, as ferramentas de esquema, a sincronização de dados, os notebooks e as ferramentas de administração. `packages/data-tools/src/policy-paths.test.ts` exercita cada um desses caminhos contra uma conexão `prod` e verifica que os dados não mudam.

Limites que você deve conhecer:
* A classificação é **estática e nega por padrão** (`assessStatement`): uma instrução só é uma leitura se começa com uma palavra-chave de leitura conhecida e não contém nenhuma palavra-chave de gravação; qualquer coisa não reconhecida conta como gravação. Ela não vê efeitos colaterais escondidos em funções (`SELECT nextval(...)`, `SELECT pg_terminate_backend(...)`). Para garantias firmes, use uma conta de banco de dados com privilégios somente leitura; quando o motor oferece um modo somente leitura no servidor, o RizomaDB também o ativa.
* A política protege contra erros e contra recursos do RizomaDB que se comportem mal. Uma pessoa com suas próprias credenciais de banco de dados e outro cliente ainda pode gravar: isso não substitui as permissões do banco de dados.
