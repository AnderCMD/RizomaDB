# Implantação

## Isolado da rede / offline
* A extensão **não faz nenhuma conexão de rede própria**: sem telemetria, sem verificação de atualizações, sem configuração remota. Um teste (`apps/extension/src/activation.test.ts`) falha se a ativação abrir um socket ou se o código-fonte da extensão/do core importar módulos de rede.
* Instale a partir de um VSIX (`code --install-extension rizomadb-x.y.z.vsix`) ou de um espelho interno do Open VSX. Verifique o `SHA256SUMS` e a atestação de procedência de build anexados a cada release.
* Fixe a versão nas suas ferramentas de gestão; as atualizações são explícitas.

## Instalação em massa
* **Intune / GPO / Ansible:** distribua o VSIX e execute `code --install-extension` por usuário, ou use o seu marketplace interno. Entregue `rizomadb.policy.team` e `rizomadb.catalog.teamFile` por meio de configurações gerenciadas do VS Code (escopo de máquina).
* **Dev Containers / Codespaces:** adicione o id da extensão ao `devcontainer.json`; as conexões são feitas pelo lado remoto, então o banco de dados deve ser alcançável a partir do contêiner.

## Proxies e certificados internos
* As conexões com bancos de dados podem passar por um túnel SSH (bastion host), um **proxy HTTP CONNECT** ou um **proxy SOCKS5**, escolhido por conexão em *Caminho de rede* (uma conexão usa um túnel *ou* um proxy). O código de proxy é testado contra servidores proxy falsos locais e, no CI, contra um **Squid 6** real (HTTP CONNECT, com e sem autenticação básica) e um servidor SOCKS5 real (`go-socks5-proxy`, usuário/senha) alcançando um PostgreSQL real. **Não** foi testado com o Dante nem com outros produtos de proxy, nem com proxies que exigem NTLM/Kerberos.
* As chamadas de IA da própria extensão (desligadas por padrão) e nada mais são o único tráfego que não vai a um banco de dados que você configurou.
* CAs internas: PostgreSQL e MySQL aceitam um arquivo de CA por conexão (`sslCaFile`); para todo o resto, defina `NODE_EXTRA_CA_CERTS` para o VS Code. A verificação de TLS vem ativada por padrão e desativá-la mostra um aviso modal.

## Catálogos de conexões compartilhados
`.rizomadb/connections.json` (projeto) e o arquivo indicado por `rizomadb.catalog.teamFile` (equipe) listam conexões **sem segredos**; cada usuário é consultado uma vez sobre os `secretKeys` e a resposta fica no próprio SecretStorage do VS Code dele. As entradas com segredos em texto simples são rejeitadas. As camadas posteriores substituem as anteriores por `id`. As entradas do catálogo não podem ser editadas nem excluídas pela interface.
```json
{ "version": 1, "connections": [ { "id": "orders-stg", "name": "Orders (staging)", "driver": "postgres", "environment": "staging", "options": { "host": "orders.stg.internal", "port": 5432, "database": "orders", "user": "app", "ssl": true }, "secretKeys": ["password"] } ] }
```
`${env:VAR}` e `${workspaceFolder}` são expandidos nos valores das opções.

## Workspace Trust
Em um espaço de trabalho não confiável, a política do projeto, o catálogo do projeto e os arquivos de `.rizomadb` não são carregados; as camadas de usuário e de equipe continuam se aplicando.
