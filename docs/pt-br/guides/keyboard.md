# Usar o RizomaDB com o teclado

O RizomaDB foi pensado para ser usado sem mouse. Se você encontrar algo que precise de um, é um erro: por favor, relate-o.

## Navegar
- **Tab / Shift+Tab** movem entre os controles de cada tela (Nova conexão, Configurações, Histórico, o guia, a grade de resultados, o designer de tabelas, o diagrama ER e o visualizador de planos). Cada tela é um único grupo de paradas de tabulação; em um teste de 40 pressionamentos de Tab na tela de Histórico, o foco nunca ficou preso.
- Um anel visível sempre mostra onde você está. Os botões que só têm um ícone têm um nome lido pelos leitores de tela e uma dica que também aparece quando o botão recebe o foco do teclado.
- Nas listas que se comportam como uma árvore (o plano de execução, o explorador), Tab entra na lista uma vez e as **setas** se movem dentro dela.

## No editor
| Teclas | O que faz |
|---|---|
| Ctrl/⌘ + Enter | Executa a instrução sob o cursor |
| Ctrl/⌘ + Shift + Enter | Executa a seleção |

## Na grade de resultados
As teclas para mover entre células, selecionar linhas, editar, desfazer e copiar estão em [A grade de resultados](results-grid.md). O botão de teclado da barra da grade as mostra dentro do aplicativo.

## Como isso foi verificado
- Uma auditoria automática (`test/a11y/keyboard.js`) roda em cada tela com os temas claro e escuro: todo controle que pode receber o foco tem nome e um anel de foco visível, não há `tabindex` positivo e nada que pareça clicável fica fora da ordem de tabulação. Ela encontrou um problema real (as caixas de busca só mudavam 1 px de borda ao receber o foco), já corrigido. O axe-core não relata violações nas mesmas telas.
- O responsável pelo projeto percorreu as telas com um leitor de tela no macOS, Windows e Linux sem encontrar problemas.
- Não feito: uma auditoria de acessibilidade independente. Se algo for difícil de alcançar pelo teclado, abra um issue.
