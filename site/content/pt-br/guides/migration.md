# Migrar para o RizomaDB

O RizomaDB lê definições de conexão de outras ferramentas por meio de **RizomaDB: Importar conexões de outras ferramentas…**. Nada é enviado para lugar nenhum; os arquivos são analisados localmente.

| Origem | O que é importado | O que NÃO é importado |
|---|---|---|
| URI de conexão (`postgres://`, `mysql://`, `mongodb://`, `redis://`, ...) | host, porta, banco de dados, usuário, indicador de TLS | — (a senha da URI é oferecida ao SecretStorage, nunca gravada nas configurações) |
| `~/.pgpass` | host, porta, banco de dados, usuário, senha | Entradas com curinga (`*`) são ignoradas |
| `~/.my.cnf` | host, porta, usuário, senha | Grupos de opções diferentes de `client`/`mysql` |
| `data-sources.json` do DBeaver | nome, driver, host, porta, banco de dados | Nomes de usuário e senhas (o DBeaver os criptografa; digite-os na primeira conexão) |
| `settings.json` do SQLTools (`sqltools.connections`) | nome, driver, host, porta, banco de dados, usuário | Drivers que o RizomaDB não implementa |

As senhas encontradas em texto simples só são guardadas depois que você confirma, e apenas no SecretStorage do VS Code.

## Do Database Client (cweijan) e do DBCode
Não há formato de importação implementado para eles: o armazenamento de conexões dessas ferramentas não foi verificado em fontes primárias, então não adivinhamos. Use o importador de URI ou recrie as conexões com o assistente.

## Conceitos que mudam
- **As edições entram em fila.** As edições na grade viram um conjunto de alterações pendentes que você revisa e aplica em uma transação; nada é gravado ao confirmar a célula.
- **Política.** As conexões `prod` são somente leitura por padrão; altere isso no perfil da conexão ou nos arquivos de política (`docs/enterprise/policy.md`).
- **Sem telemetria.** Não há nada de que desistir.
