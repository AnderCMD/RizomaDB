# Edição de dados

## O que pode ser editado
Um resultado é editável quando vem de **abrir uma tabela** cujas linhas o RizomaDB consegue identificar:

| Motor | As linhas são identificadas por |
|---|---|
| SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, DuckDB | a chave primária |
| MongoDB | o `_id` do documento |

Views, consultas personalizadas, linhas de consulta editadas, colunas mascaradas, conexões somente leitura e tabelas sem chave primária **não** são editáveis; quando você tenta, a grade diz o motivo. Todos os outros motores, incluindo as chaves do Redis e do Valkey, são somente leitura na grade (o Redis tem comandos próprios para excluir, renomear e expirar chaves).

## Como
1. **Dê dois cliques** em uma célula (ou selecione-a e pressione **Enter** ou **F2**, ou use o botão de lápis). Uma caixa abre com o valor.
2. Digite e pressione **Enter** para manter, **Esc** para cancelar. **Delete** define NULL; o menu do botão direito tem *Definir como NULL* e *Definir como texto vazio*.
3. **Adicionar linha** acrescenta uma linha; as células não definidas mostram `DEFAULT`. O botão de lixeira marca as linhas selecionadas para exclusão (e as restaura). Desfazer (Ctrl/⌘+Z) descarta as linhas adicionadas.
   **Colar de uma planilha:** selecione uma célula e pressione Ctrl/⌘+V. As células separadas por tabulação (o que o Excel, o Numbers e o Sheets copiam) preenchem para baixo e para a direita a partir da célula selecionada, as células vazias viram NULL e um único valor preenche todas as linhas selecionadas dessa coluna. Até 5.000 células por colagem; é um único passo para desfazer e, se alguma célula não for válida para sua coluna, nada é aplicado.
4. O rodapé da barra de edição conta as **alterações pendentes**. As células editadas ficam destacadas e as linhas excluídas ficam riscadas.

Os valores são verificados contra o tipo da coluna enquanto você digita: uma coluna inteira recusa `abc`, as colunas JSON devem ter JSON válido e as colunas binárias não podem ser editadas aqui.

## Revisar e aplicar
- **Revisar o SQL** abre as instruções exatas que seriam executadas (com seus parâmetros), sem executá-las.
- **Aplicar** envia todas as alterações **em uma transação** nos motores que têm transações. Nos motores sem transações (por exemplo, o MongoDB), as alterações são aplicadas uma a uma, e a mensagem diz quantas já foram aplicadas se alguma falhar.
- Produção e staging pedem confirmação antes de aplicar; `requireApproval` pede que você digite o nome da conexão. As políticas, as conexões somente leitura e o log de auditoria se aplicam exatamente como no editor.
- **Detecção de conflitos.** Cada alteração verifica se a linha ainda tem os valores que você viu; se outra pessoa a alterou ou excluiu, nada é aplicado e você é avisado.
- **Descartar** abandona tudo o que está pendente.

## Salvar cada edição imediatamente
Ative `rizomadb.edit.applyImmediately` se não quiser uma etapa separada de Aplicar. Cada edição é aplicada assim que você a confirma. Somente as conexões `dev` pulam a pergunta; todos os outros ambientes ainda perguntam, e as políticas e as regras de somente leitura sempre se aplicam. Desativado por padrão.

## Alterar a estrutura
Renomear, alterar o tipo ou excluir uma coluna está no menu da coluna (veja [A grade de resultados](results-grid.md#trabalhar-com-colunas)). Novas tabelas e alterações maiores usam **Projetar tabela**, com uma pré-visualização do DDL antes de qualquer execução.
