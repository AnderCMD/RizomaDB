# Ajude a testar o RizomaDB

O RizomaDB foi testado com motores locais, contêineres e emuladores oficiais, por uma só pessoa. Ele **não** foi testado com contas reais na nuvem nem por muita gente em muitos sistemas, e é aí que os erros têm mais chance de se esconder. Se você puder rodar algo do que segue, um relato curto é valioso, **funcione ou não**.

## O que é mais útil
1. **Nuvem e serviços gerenciados**: Amazon DynamoDB na AWS, Google Cloud Firestore, MongoDB Atlas e PostgreSQL/MySQL gerenciados (RDS, Aurora, Cloud SQL, Azure Database, Neon, Supabase, PlanetScale). Veja [Nuvem e serviços gerenciados](../engines/README.md#nuvem-e-serviços-gerenciados-não-confirmados).
2. **Outros sistemas operacionais e leitores de tela**: Windows e Linux com NVDA, JAWS ou Orca; um percurso só com teclado pelas telas ([Usar o teclado](keyboard.md)).
3. **Seus próprios bancos de dados**: tabelas maiores, tipos de coluna estranhos, redes lentas, túneis SSH e proxies.
4. **Traduções**: falantes nativos de português (Brasil) e francês podem revisar os textos ([CONTRIBUTING.pt-br.md](https://github.com/AnderCMD/RizomaDB/blob/main/CONTRIBUTING.pt-br.md#revisar-uma-tradução)).

## Como testar com segurança
- Use um **usuário somente leitura** ou um banco de dados descartável. Ative primeiro o interruptor de somente leitura da conexão.
- Percorra os passos do formulário de relato: conectar, explorar, executar uma consulta, carregar mais, ordenar e filtrar. Edite dados apenas em uma tabela que você possa perder.
- O RizomaDB não envia nada para lugar nenhum: não há telemetria. Um relato só existe se você o escrever.

## Como relatar
Abra um issue **Test report** no GitHub (o formulário lista os passos para marcar). Informe o motor e a versão, onde ele roda, seu sistema, o que funcionou e, se falhou, a mensagem exata. **Nunca cole senhas, tokens, chaves nem dados privados.** O canal de saída *RizomaDB policy* e a barra de status mostram o que bloqueou uma ação.

Um relato que diz «funciona» é tão útil quanto um erro: é a única forma de um serviço passar de «não confirmado» a «testado».
