# Conexões

## A tela Nova conexão
**RizomaDB: Nova conexão** abre uma tela com cada motor como um cartão com seu logotipo, agrupados por tipo. Escolha um e preencha o formulário.

- **Padrões por motor.** Host, porta e o usuário habitual já estão lá (por exemplo, PostgreSQL `postgres@localhost:5432/postgres`, MySQL e MariaDB `root`, SQL Server `sa`, Oracle `system` com o serviço `FREEPDB1`, MongoDB e Redis sem usuário). Os campos de que um motor não precisa ficam vazios e opcionais.
- **TLS na sua própria máquina.** Para `localhost`, `127.0.0.1` e `::1`, a caixa de TLS começa desmarcada, porque servidores locais raramente falam TLS, e nenhum aviso é mostrado. Altere o host para um remoto e ela volta ao padrão do motor; desmarcar o TLS de um host remoto pede que você confirme.
- **Testar conexão** conecta e faz um ping sem guardar nada. **Salvar conexão** guarda o perfil e conecta; se isso falhar, você pode corrigir os campos e tentar de novo, ou escolher **Salvar sem conectar**.
- **Os serviços na nuvem não estão confirmados.** O RizomaDB só foi testado com motores locais e emuladores oficiais, nunca com uma conta real na nuvem (AWS, Google Cloud, Atlas, PostgreSQL/MySQL gerenciados). Tente primeiro com um usuário somente leitura ou um banco de dados descartável; veja [Motores](../engines/README.md#nuvem-e-serviços-gerenciados-não-confirmados).
- Senhas, tokens e chaves vão para o **armazenamento de segredos** do VS Code. Um catálogo compartilhado nunca os contém: cada pessoa digita os seus.

### Ambientes e proteção
Toda conexão tem um ambiente. `prod` é somente leitura por padrão e `staging` pergunta antes de cada gravação. Escolha **Novo ambiente…** no formulário para criar o seu: dê um nome (letras minúsculas, dígitos e hifens) e uma proteção:

| Proteção | Efeito |
|---|---|
| Perguntar antes de cada gravação | Uma confirmação para cada instrução que altera dados |
| Bloquear gravações | O ambiente é somente leitura |
| Sem proteção | Nada além do normal |

Os novos ambientes são salvos na configuração `rizomadb.environments`, onde você também pode editá-los. Eles só podem tornar as coisas mais restritivas que seus arquivos de política, nunca menos. Veja [Políticas](../enterprise/policy.md).

### Caminho de rede
Por padrão, o RizomaDB conecta diretamente. Em **Caminho de rede** você pode passar por um **túnel SSH** (arquivo de chave ou senha, com verificação estrita da chave do host e um aviso para hosts desconhecidos) ou por um **proxy HTTP** / **proxy SOCKS5** (com usuário e senha opcionais). Uma conexão usa um túnel SSH *ou* um proxy, não os dois.

## Conexões salvas
A segunda aba da mesma tela lista as conexões que você tem. Cada cartão mostra o logotipo do motor, o ambiente, se é somente leitura ou compartilhada, o destino (`host:porta`) e seu **banco de dados**, e se está conectada. Um selo **● Ativa** marca a que está em uso. Os botões conectam ou desconectam, abrem uma nova consulta, alternam o somente leitura e excluem.

## A árvore de conexões
- As conexões são agrupadas por tipo de motor (desative com `rizomadb.explorer.groupByFamily`).
- Cada linha traz o logotipo do motor, `[AMBIENTE]`, o banco de dados e um ponto para a ativa.
- Sob uma conexão: **Tabelas** (ou Coleções, Chaves, Índices, Rótulos, Medições, conforme o motor) com uma contagem, e **Views**.
- Passe o mouse sobre uma linha para ver botões rápidos. O título da visão tem botões para nova conexão, atualizar, importar, configurações, o guia e **recolher tudo**.

## A conexão em uso
A conexão *ativa* é a vinculada ao editor de consultas em que você está, ou a última que executou algo. A barra de status a mostra como `[AMB] nome · banco de dados`; clique nela para alterar a conexão do editor atual.

## Uma conta somente leitura para a garantia no servidor
Marcar uma conexão como somente leitura é imposto pelo RizomaDB (e pelo servidor, quando o motor permite). Para uma garantia que não dependa de nenhum cliente, dê à conexão uma conta de banco de dados que só possa ler. Clique com o botão direito na conexão e escolha **Gerar script de usuário somente leitura…**: você escolhe o nome da conta e o RizomaDB abre um script em um editor. Ele nunca o executa e nunca grava uma senha: substitua o marcador `<choose-a-password>` e execute-o com uma conta de administrador. Disponível para PostgreSQL, MySQL/MariaDB, ClickHouse e Redis/Valkey; cada script foi executado em um servidor real e se verificou que a nova conta lê e é impedida de gravar (os outros motores dizem isso em vez de adivinhar).

## Importar de outras ferramentas
**RizomaDB: Importar conexões de outras ferramentas…** lê strings de conexão, `~/.pgpass`, `~/.my.cnf` e arquivos do DBeaver e do SQLTools. Veja [Migrar](migration.md).

## Mover conexões em um arquivo selado
**Exportar conexões (criptografadas)…** grava suas conexões salvas em um arquivo `.rzcat` selado com uma frase secreta que você escolhe (AES-256-GCM, chave derivada com scrypt); **Importar conexões (criptografadas)…** lê um. O arquivo contém apenas perfis: as senhas ficam no armazenamento de segredos de cada pessoa e são pedidas na primeira conexão. Uma frase secreta errada ou um arquivo alterado é rejeitado por inteiro, e as conexões cujo id já existe são ignoradas. Você pode enviar o arquivo por qualquer canal; guarde a frase secreta separadamente.

## Compartilhar conexões com uma equipe
Um arquivo de catálogo (`.rizomadb/connections.json` no projeto, ou o arquivo indicado em `rizomadb.catalog.teamFile`) lista conexões sem segredos; cada pessoa adiciona sua própria senha na primeira vez. As entradas compartilhadas são somente leitura na interface.
