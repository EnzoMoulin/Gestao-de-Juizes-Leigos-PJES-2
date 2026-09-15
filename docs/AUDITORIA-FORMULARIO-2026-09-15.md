# Auditoria do formulário — 15/09/2026

Formulário auditado: **CONECTA JULES — Formulário de teste**
(`1FAIpQLSenUp7ShEu8a13psWqG7on_Ru5gSox4hgADY1HL_Pxymevw4A`).
Método: definição real das 19 perguntas extraída do HTML salvo
(`FB_LOAD_DATA_`), incluindo obrigatoriedade, validação e destino por opção.

## Conforme

- Roteamento por cargo: Magistrada/Assessor → seção de solicitações
  (id `31444021`); Juiz Leigo → seção de produtividade (id `854569824`),
  sem passar pela pergunta de quantidade.
- Pergunta `Quantas minutas estão sendo solicitadas?` existe, obrigatória,
  na seção de solicitações. Unidade, Nome e Telefone obrigatórios.
- Capacidade (`Número de minutas em que necessita trabalhar no mês atual:`)
  obrigatória na seção do juiz, **com** validação `^[1-9][0-9]*$`.

## Não conforme

1. A pergunta de quantidade **não tem validação de resposta** (a de
   capacidade tem). Sem ela, o Forms aceita "20 a 30", "cerca de 20",
   "10,5" — e o site marca "Revisar quantidade", bloqueando a designação
   até correção pelo solicitante. Correção no editor: ⋮ da pergunta →
   Validação de resposta → Expressão regular → Corresponde a →
   `^[1-9][0-9]*$`, mensagem sugerida em `docs/QUANTIDADE_SOLICITANTE.md`.
2. O título da pergunta tem espaços duplos no início e no fim. Inofensivo
   para o site (cabeçalhos são normalizados com trim antes da leitura),
   mas limpar para o título exato evita uma coluna com espaços na planilha.
3. Existe a seção "Histórico de perguntas substituídas" com 4 perguntas
   legadas `[Histórico]`. Confirmar no editor que a seção de produtividade
   termina em Enviar, para que essa seção nunca seja alcançada.

## Escopo

Auditoria restrita ao formulário de **teste**. O formulário de produção
segue sem a pergunta (comprovado pela ausência da coluna na planilha viva),
portanto nada aqui altera produção até a replicação manual descrita em
`docs/QUANTIDADE_SOLICITANTE.md`, seguida de respostas de teste e nova
versão do Web App.
