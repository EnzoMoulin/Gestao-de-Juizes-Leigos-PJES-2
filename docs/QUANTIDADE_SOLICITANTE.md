# Quantidade informada pelo solicitante

## Regra desta versão

Uma solicitação pode conter várias minutas. O magistrado ou assessor informa seu volume no formulário. O site apresenta esse valor somente para consulta, e o servidor rejeita qualquer tentativa administrativa de alterá-lo, inclusive de clientes antigos. A capacidade mensal do juiz continua editável pelo ADMIN na área administrativa.

| Informação | Origem | Edição pelo site |
| --- | --- | --- |
| Quantidade solicitada | Resposta a `Quantas minutas estão sendo solicitadas?` | Não permitida |
| Capacidade mensal do juiz | Resposta de cadastro, campo `Número de minutas em que necessita trabalhar no mês atual:` | ADMIN |
| Prioridade e prazo | `GESTAO_SOLICITACOES`, colunas B e C | GESTOR / ADMIN |
| Quantidade operacional antiga | `GESTAO_SOLICITACOES.QUANTIDADE_MINUTAS` | Preservada como histórico, ignorada no cálculo |

A carga conhecida é a soma das quantidades válidas das solicitações ativas designadas ao juiz. Designar novamente o mesmo pedido não soma duas vezes; concluir ou cancelar libera essa carga. Não há reset mensal automático nesta alteração.

## Ativação no Google Forms — ação manual necessária

Esta alteração de código não edita o formulário publicado e não altera a implantação do Apps Script. A conexão usada não disponibiliza edição de perguntas do Forms.

1. Abra o formulário vinculado à planilha de teste no editor do Google Forms.
2. Na seção de solicitações usada por **magistrados e assessores**, adicione uma pergunta do tipo **Resposta curta**, com o título exato `Quantas minutas estão sendo solicitadas?` (sem aspas). Evite criar duas perguntas com o mesmo título; ambos os cargos devem chegar à mesma seção que contém essa pergunta.
3. Ative **Obrigatória**. Na validação de resposta, selecione **Expressão regular → Corresponde a** e use `^[1-9][0-9]*$`. Mensagem sugerida: `Informe um número inteiro maior que zero, sem pontos ou vírgulas.`
4. Confira o direcionamento por cargo: magistrado e assessor passam pela seção de solicitações; juiz leigo passa pela seção de cadastro e **não** pela pergunta de quantidade solicitada. Ao terminar o cadastro de juiz, não deixe a navegação continuar automaticamente para a seção de solicitações.
5. Mantenha a pergunta de capacidade mensal somente no fluxo do juiz leigo. Não a renomeie para a nova pergunta: são informações diferentes.
6. Envie respostas de teste para cada fluxo e confira o cabeçalho criado na planilha vinculada. O sistema procura a nova pergunta pelo título, não pela letra da coluna. Não crie manualmente uma coluna substituta para aparentar uma resposta do Forms.
7. Atualize todos os arquivos de `src/` no projeto do site, preservando nomes e maiúsculas/minúsculas, e publique uma **nova versão** da implantação. Recarregue o site. Alterações apenas no GitHub não são aplicadas ao Apps Script.

Referências oficiais: [validação de respostas](https://support.google.com/docs/answer/3378864?hl=pt-BR) e [direcionamento entre seções](https://support.google.com/docs/answer/141062?hl=en-GB).

## Como ficam as abas

- `Respostas ao formulário 1`: mantém o histórico bruto dos dois fluxos e recebe a nova coluna criada pelo Forms. Em linhas de juiz, a quantidade solicitada fica vazia; em linhas de magistrado/assessor, fica preenchida. Não exclua respostas nem reordene linhas: os vínculos de gestão ainda usam a linha de origem.
- `Juízes Leigos Disponíveis`: permanece uma visão derivada somente dos cadastros de juiz. Não precisa receber a nova pergunta de quantidade solicitada. Preserve sua fórmula e seus cabeçalhos; não é um segundo local para editar cadastros.
- `GESTAO_SOLICITACOES`: continua com prioridade, prazo e informações de atualização em A:E. A coluna F legada é mantida, mas não é lida como resposta do solicitante nem sobrescrita ao salvar. O aplicativo funciona também com a estrutura antiga de cinco colunas.

Não é necessário apagar, mover ou copiar quantidades antigas entre abas. `prepararPlanilha` não cria a pergunta no formulário.

## Solicitações antigas sem quantidade

Não existe conversão automática para 1 minuta, nem uso da capacidade do juiz ou contagem dos processos como substituto. O preenchimento administrativo antigo é preservado, mas não é tratado como resposta do solicitante.

Peça ao solicitante para complementar a resposta original pelo mecanismo de edição de respostas, caso já esteja disponível. Não compartilhe links de edição de uma pessoa com outra. Se esse fluxo não estiver disponível, é necessário definir um procedimento de complementação antes de liberar o pedido; esta versão não cria esse procedimento nem habilita novas permissões automaticamente. Não envie pedidos duplicados para contornar o bloqueio sem antes resolver o registro anterior.

Solicitações antigas sem quantidade podem ser consultadas, anotadas e encerradas; não podem ser designadas ou reabertas com juiz atribuído até que haja quantidade válida. Se já estiverem ativas e atribuídas, o juiz mostra **carga parcial**: o saldo considera apenas volumes conhecidos, não uma capacidade livre garantida. Valores preenchidos de forma inválida exigem correção do solicitante.

O bloqueio é do aplicativo. Ele não retira permissões de quem já pode editar diretamente a planilha no Google Sheets. Revisar essas permissões é uma decisão separada; elas não foram alteradas por este código.

## Homologação antes de usar em produção

1. Nova solicitação de magistrado com 3 minutas: aparece com quantidade 3, sem campo editável na administração.
2. Nova solicitação de assessor com 5 minutas: aparece com quantidade 5; vazio, zero, negativos, decimais e texto devem ser recusados no Forms.
3. Cadastro de juiz com capacidade 20: não exige quantidade solicitada. O ADMIN consegue mudar a capacidade.
4. Designe os pedidos de 3 e 5 ao juiz de capacidade 20: carga 8 e saldo 12. Conclua o pedido de 3: carga 5 e saldo 15.
5. Abra um pedido antigo sem quantidade: a designação deve ser bloqueada, mas cancelar com justificativa deve funcionar.
6. Após uma alteração da resposta original pelo solicitante, uma tela de edição já aberta deve exigir atualização. Uma resposta editada pode mudar a carga de um pedido já ativo; confira o novo saldo e eventuais excessos.

Os testes automatizados usam dados simulados. Não substituem esta homologação no formulário e na implantação reais.
