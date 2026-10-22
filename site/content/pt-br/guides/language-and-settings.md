# Idioma e configurações

## A tela de configurações
**RizomaDB: Abrir as configurações** (a engrenagem na visão de conexões) mostra cada configuração como um cartão com um botão de redefinir por cartão, uma caixa de busca e **Redefinir tudo**. As alterações são salvas nas suas configurações de usuário conforme você as faz. A lista completa com os padrões está na [Referência de configurações](../reference/settings.md); os grupos interessantes são:

| Grupo | O que você pode alterar |
|---|---|
| Idioma | O idioma da extensão (veja abaixo) |
| Resultados | Onde os resultados abrem (metade inferior, área inteira, ao lado) |
| Ambientes | Ambientes extras e sua proteção |
| Consultas | Linhas por página, máximo de linhas, tempo limite |
| Editor de consultas | Lentes de execução e destaque da instrução |
| Edição | Salvar cada edição imediatamente |
| Árvore de conexões | Agrupar as conexões por tipo de motor |
| Segurança | Confirmações, produção somente leitura |
| Histórico, Auditoria, MCP, IA | Retenção e o que é registrado, o servidor MCP somente leitura opcional, o assistente de IA opcional |

## Idioma
O RizomaDB fala **inglês, espanhol, português (Brasil) e francês**. Por padrão, segue o idioma de exibição do VS Code. Para alterar apenas a extensão, defina `rizomadb.language` como `en`, `es`, `pt` ou `fr`; as telas que você já tem abertas mantêm o idioma antigo até serem reabertas.

Os nomes de comandos, de configurações e os títulos de visões são fornecidos ao VS Code pelo mecanismo dele, então sempre seguem o idioma **do VS Code**. A tela de configurações tem um botão que abre o seletor de idioma do VS Code. As mensagens de um servidor de banco de dados (por exemplo, um erro de sintaxe) são mostradas como o servidor as escreveu; as mensagens que o próprio RizomaDB escreve são traduzidas. O texto em espanhol é revisado pelo mantenedor; as traduções para o português e o francês foram escritas com ajuda de IA e **não** foram revisadas por falantes nativos, então correções de redação são bem-vindas.

## O guia
**RizomaDB: Abrir o guia** abre um tour passo a passo com botões que executam cada etapa por você. Ele também aparece uma vez, na primeira vez que a extensão roda. Há um roteiro *Primeiros passos* equivalente na página de boas-vindas do VS Code.
