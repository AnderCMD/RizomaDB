---
layout: home
hero:
  name: RizomaDB
  text: Todos os seus bancos de dados, em um só lugar.
  tagline: Um cliente de banco de dados gratuito, de código aberto e sem telemetria para o VS Code. 24 motores, uma grade de resultados, seguro por padrão.
  image: { src: /logo.svg, alt: RizomaDB }
  actions:
    - { theme: brand, text: Primeiros passos, link: /pt-br/guides/getting-started }
    - { theme: alt, text: Motores, link: /pt-br/reference/engine-matrix }
    - { theme: alt, text: GitHub, link: "https://github.com/AnderCMD/RizomaDB" }
features:
  - { icon: "🔌", title: "Conecte a partir de uma tela de logotipos", details: "Escolha seu motor; host, porta e usuário já vêm preenchidos. Ambientes com proteção, túneis SSH, proxies e segredos somente no armazenamento de segredos do VS Code.", link: /pt-br/guides/connections }
  - { icon: "▶️", title: "Um botão Executar acima de cada instrução", details: "Executar, Explicar, Executar tudo, parâmetros, histórico com busca e notebooks, na linguagem de cada motor.", link: /pt-br/guides/query-editor }
  - { icon: "🗂️", title: "Uma grade feita para explorar", details: "Ordene, filtre nas linhas ou no banco de dados, redimensione, oculte, painel de registro, copie como CSV/JSON/Markdown e Carregar mais em todos os motores.", link: /pt-br/guides/results-grid }
  - { icon: "✏️", title: "Edite no lugar, com segurança", details: "Dois cliques em uma célula. As alterações ficam pendentes; revise o SQL e aplique-as em uma transação, com detecção de conflitos.", link: /pt-br/guides/editing-data }
  - { icon: "🛡️", title: "Seguro por padrão", details: "Políticas em camadas em que a mais restritiva vence, um único ponto de auditoria para toda escrita, produção somente leitura, mascaramento de colunas.", link: /pt-br/enterprise/policy }
  - { icon: "🌍", title: "Quatro idiomas", details: "Inglês, espanhol, português (Brasil) e francês. Troque o idioma dentro da extensão e siga o guia integrado que leva você pela mão.", link: /pt-br/guides/language-and-settings }
---

::: warning Pré-lançamento
O RizomaDB ainda não está publicado em nenhum marketplace e a v1.0 não está pronta. A [comparação honesta](/pt-br/market/honest-comparison) e a [lista de aceitação](/es/release/v1-checklist) (em espanhol) dizem exatamente o que está e o que não está verificado.

**Os serviços na nuvem não estão confirmados.** O RizomaDB só foi testado com motores locais e emuladores oficiais, nunca com uma conta real na nuvem (AWS, Google Cloud, MongoDB Atlas, PostgreSQL/MySQL gerenciados). Teste com um usuário somente leitura ou um banco de dados descartável antes de depender dele: veja [Nuvem e serviços gerenciados](/pt-br/engines/#nuvem-e-serviços-gerenciados-não-confirmados).

Os textos em português e francês foram escritos com ajuda de IA e ainda não foram revisados por falantes nativos.
:::

## Por onde começar
- Se você é novo: [Primeiros passos](/pt-br/guides/getting-started) e depois [Conexões](/pt-br/guides/connections).
- Se vem de outra ferramenta: [Migrar para o RizomaDB](/pt-br/guides/migration) e a [comparação honesta](/pt-br/market/honest-comparison).
- Se procura um motor: a [matriz de capacidades](/pt-br/reference/engine-matrix) e as [páginas de motores](/pt-br/engines/README).
- Se vai implantá-lo em uma equipe: [Políticas](/pt-br/enterprise/policy), [Implantação](/pt-br/enterprise/deployment) e [Conformidade](/pt-br/enterprise/compliance).
- Se algo falhar: [Solução de problemas](/pt-br/guides/troubleshooting).
