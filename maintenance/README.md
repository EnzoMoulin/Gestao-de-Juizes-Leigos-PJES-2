# Preparação em projeto separado

Use esta alternativa quando o comando privado não aparecer no seletor do editor.

1. Crie um **novo projeto** em https://script.google.com usando a conta institucional. Nome sugerido: CONECTA JULES — Manutenção.
2. Copie todo o arquivo PrepararPlanilha.gs desta pasta para Código.gs do novo projeto. Não copie para o projeto do site e não implante este projeto.
3. Nas propriedades do **novo projeto**, copie SPREADSHEET_ID e ADMIN_EMAILS do projeto do site. Se SOURCE_SHEET ou INSTITUTIONAL_DOMAIN tiverem valores personalizados, copie também. Propriedades não são compartilhadas entre projetos.
4. Salve e selecione prepararPlanilha (sem sublinhado). Execute e autorize com uma conta de ADMIN_EMAILS que tenha edição na planilha.
5. O comando verifica os cabeçalhos de origem e prepara USUARIOS, AUDITORIA e GESTAO_SOLICITACOES sem apagar respostas ou usuários. A coluna `QUANTIDADE_MINUTAS` registra a quantidade operacional de cada solicitação; ela não substitui a capacidade mensal informada no cadastro do juiz.
6. Se existir a aba `Juízes Leigos Disponíveis`, o comando alinha somente sua linha de cabeçalho à ordem retornada pela fórmula `FILTER` (A:R). A fórmula e as respostas originais permanecem intactas.
7. Volte ao projeto do site para publicar sua versão atualizada. Esta ferramenta não verifica a implantação nem resolve uma eventual identidade vazia no login do site.

Esta separação permite usar a identidade executora para manutenção sem disponibilizar uma função com os privilégios do proprietário aos visitantes do Web App. Não renomeie o comando privado do projeto do site para torná-lo público.

Testes locais: node tests/maintenance.js. Não houve execução na planilha real.
