# Primeiros passos

Esta página leva você do zero até editar um valor em uma tabela. O mesmo passo a passo está embutido na extensão: execute **RizomaDB: Abrir o guia** (o ícone de livro na visão de conexões) e ele conduz você etapa por etapa, com botões que executam cada passo por você.

## 1. Instalar
O RizomaDB ainda não está publicado em nenhum marketplace. Compile a extensão e instale o arquivo:

```bash
pnpm install
pnpm --filter rizomadb package          # cria apps/extension/rizomadb-<versão>.vsix
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```

Ele também se instala no VSCodium, Cursor e Windsurf (use o próprio `--install-extension` deles). Recarregue a janela depois.

## 2. Criar uma conexão
1. Clique no ícone do RizomaDB na barra de atividades e depois no botão **+** (ou execute **RizomaDB: Nova conexão**).
2. Escolha seu motor pelo logotipo. Use a caixa de busca se a lista for longa.
3. O formulário já vem preenchido com os valores habituais desse motor (host `localhost`, a porta padrão, o usuário típico). Altere apenas o que for diferente e adicione a senha.
4. Escolha o **ambiente**: `dev`, `staging`, `prod` ou **Novo ambiente…** para o seu (por exemplo `qa`). Produção pede confirmação antes de gravar; veja [Conexões](connections.md).
5. **Testar conexão** verifica sem salvar. **Salvar conexão** a guarda. Se não for possível conectar, você ainda pode escolher **Salvar sem conectar**.

## 3. Explorar
A árvore de conexões agrupa suas conexões por tipo (relacional, documentos, chave-valor…) e mostra o logotipo de cada motor. Expanda uma para ver suas tabelas (ou coleções, chaves, índices…) e views. A barra de status, na parte de baixo, mostra a conexão em uso e seu banco de dados.

## 4. Abrir uma tabela
Clique em uma tabela. As linhas abrem na metade inferior da janela. As abas acima da grade mostram **Dados**, **Propriedades** (colunas, tipos, índices), **Relações** (chaves estrangeiras nos dois sentidos) e **DDL** (o script CREATE). Veja [A grade de resultados](results-grid.md).

## 5. Executar uma consulta
Execute **RizomaDB: Nova consulta**, escreva uma instrução e pressione **Ctrl+Enter** (⌘+Enter no Mac). Cada instrução também ganha um botão **Executar** acima dela. Veja [O editor de consultas](query-editor.md).

## 6. Editar um valor
Em uma tabela que tenha chave primária, dê dois cliques em uma célula (ou pressione Enter ou F2), digite e pressione Enter. A alteração fica esperando como *alteração pendente*: revise o SQL e pressione **Aplicar**. Produção e staging pedem confirmação antes. Veja [Edição de dados](editing-data.md).

## 7. Deixe do seu jeito
Execute **RizomaDB: Abrir as configurações** para abrir a tela de configurações: idioma, onde os resultados abrem, linhas por página, ambientes e mais. Veja [Idioma e configurações](language-and-settings.md).

## Bom saber
- Nada é enviado para lugar nenhum. Não há telemetria nem conta. Senhas e tokens ficam no armazenamento de segredos do VS Code, nunca em um arquivo de configurações.
- Se algo não funcionar como você espera, veja [Solução de problemas](troubleshooting.md).
