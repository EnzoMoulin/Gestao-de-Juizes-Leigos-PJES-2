# PJES - CONECTA JULES - Gestão de Juízes Leigos

Aplicativo institucional em Google Apps Script para acompanhar solicitações, disponibilidade e capacidade de juízes leigos. A aplicação lê a planilha de respostas do formulário, mantém dados de gestão em abas auxiliares e registra todas as alterações administrativas.

## Candidata de 11 de setembro de 2026

Auditoria e mudanças em [docs/AUDITORIA_2026-09-11.md](docs/AUDITORIA_2026-09-11.md). Esta candidata adiciona controle de versão nas gravações, validação de capacidade na reabertura, inteiros sem ambiguidade, lista compacta, paginação e relatório para impressão. Homologação visual e no Workspace ainda são necessárias. Atualize cliente e servidor juntos.

## Quantidade informada pelo solicitante

A quantidade agora vem exclusivamente da pergunta **“Quantas minutas estão sendo solicitadas?”**, obrigatória para magistrados/assessores. No site ela é somente leitura; APIs rejeitam alterações administrativas. O limite mensal do juiz continua editável pelo ADMIN. Configure o formulário e atualize a implantação conforme [docs/QUANTIDADE_SOLICITANTE.md](docs/QUANTIDADE_SOLICITANTE.md). Publicar no GitHub não atualiza o Google Forms nem o Web App.

## Funcionalidades

- Autenticação pela sessão Google Workspace e lista privada de contas autorizadas.
- Perfis `CONSULTA`, `GESTOR` e `ADMIN`.
- Indicadores e alertas de solicitações atrasadas, antigas ou sem juiz.
- Busca, filtros avançados, ordenação e exportação CSV.
- Tela completa de detalhes e histórico de alterações.
- Prioridade (`Normal`, `Alta`, `Urgente`) e prazo por solicitação.
- Designação e redesignação de juiz com confirmação.
- Cálculo de carga, saldo e percentual de ocupação dos juízes.
- Justificativa obrigatória para exceder capacidade, concluir ou cancelar.
- Notificações institucionais por e-mail, configuráveis.
- Administração de usuários dentro do site.
- Aba Administração para editar cadastros de juízes leigos: nome, e-mail, telefone, limite mensal de minutas, matérias, observações e status.
- Auditoria de designações, atualizações e alterações de usuários.
- Tutorial e visita guiada sob demanda.
- Atualização automática a cada minuto, pausada durante edição ou com a página oculta.
- Diagnóstico da fonte para gestores: planilha, aba, contagens e registros não reconhecidos.
- Busca de juízes por nome, matéria e observação.

## Arquitetura e segurança

O Web App deve ser implantado por uma conta Google Workspace do TJES para **executar como o proprietário**, com acesso restrito ao domínio. O sistema identifica a conta por `Session.getActiveUser()`, valida o domínio e aplica uma segunda camada de autorização.

As respostas originais do formulário permanecem na aba `Respostas ao formulário 1`. Informações adicionais são mantidas em:

- `USUARIOS`: perfis, situação e último acesso.
- `AUDITORIA`: alterações com usuário, data, valores anteriores e novos.
- `GESTAO_SOLICITACOES`: prioridade, prazo e última atualização. `QUANTIDADE_MINUTAS` é uma coluna histórica preservada, não utilizada no cálculo.

Alterações no cadastro de juiz são gravadas na linha original da aba `Respostas ao formulário 1`, somente por `ADMIN`, com controle de versão para evitar sobrescrever uma edição mais recente e registro na aba `AUDITORIA`. Nome não pode ser alterado enquanto houver solicitações ativas designadas ao cadastro; status de encerramento também exige que essas solicitações sejam tratadas primeiro.

Contas definidas em `ALLOWED_EMAILS` ou `ADMIN_EMAILS` são acessos fixos de recuperação e não podem ser desativadas pela interface.

## Propriedades do script

Em **Configurações do projeto → Propriedades do script**, configure:

| Propriedade | Finalidade | Exemplo |
|---|---|---|
| `SPREADSHEET_ID` | ID da planilha de respostas | ID encontrado na URL da planilha |
| `SOURCE_SHEET` | Nome exato da aba de respostas (opcional) | Padrão: `Respostas ao formulário 1` |
| `ALLOWED_EMAILS` | Contas fixas autorizadas, separadas por vírgula | `usuario1@dominio,usuario2@dominio` |
| `ADMIN_EMAILS` | Administradores fixos, separados por vírgula | `administrador@dominio` |
| `INSTITUTIONAL_DOMAIN` | Domínio institucional permitido | `tjes.jus.br` |
| `SEND_NOTIFICATIONS` | Envia e-mails em designações e mudanças de status | `TRUE` ou `FALSE` |

Não publique os valores reais dessas propriedades no GitHub.

## Instalação e atualização

O arquivo `.clasp.json` local deve apontar para o projeto correto:

```json
{
  "scriptId": "ID_DO_PROJETO_APPS_SCRIPT",
  "rootDir": "src"
}
```

Atualize o projeto:

```bash
git pull
clasp push
```

No editor do Apps Script:

1. Configure primeiro `ALLOWED_EMAILS` e `ADMIN_EMAILS` nas propriedades do script.
2. Salve o projeto. No menu de funções do editor, selecione `prepararProjetoNoEditor_` (com o `_` final), clique em Executar e autorize com a conta institucional configurada em `ADMIN_EMAILS`.
3. Esse comando instala as abas auxiliares e verifica a configuração. Confira as mensagens no Registro de execução. Ele usa a conta executora do editor e não pode ser chamado pelo site. Se não aparecer no seletor, abra `API.gs`, confira se o código foi copiado por completo, salve e recarregue o editor.

Os comandos públicos antigos continuam exigindo a identidade ativa; não substitua essa verificação por `getEffectiveUser()` no login ou em endpoints públicos, pois no Web App essa conta pode ser a do proprietário.

4. Acesse **Implantar → Gerenciar implantações → Editar**.
5. Escolha **Nova versão** e clique em **Implantar**.
6. Use a URL terminada em `/exec`.

Configuração da implantação:

- **Executar como:** proprietário do projeto.
- **Quem tem acesso:** usuários do domínio TJES.

Após esta atualização, uma nova autorização será solicitada porque o aplicativo pode usar `MailApp` para notificações. Para manter os e-mails desativados, configure `SEND_NOTIFICATIONS` como `FALSE`; a autorização do escopo ainda pode aparecer devido ao manifesto.

## Perfis

| Perfil | Permissões |
|---|---|
| `CONSULTA` | Visualiza somente solicitações vinculadas ao próprio e-mail |
| `GESTOR` | Visualiza todas as solicitações, designa juízes e atualiza andamento |
| `ADMIN` | Possui as permissões de gestão e administra usuários |

## Fluxo recomendado

1. Localize uma solicitação e abra os detalhes.
2. Defina prioridade e prazo.
3. Consulte a capacidade dos juízes.
4. Faça a designação; o status muda para `Em atendimento`.
5. Registre o andamento nas observações.
6. Marque como `Concluído` ou `Cancelado` com uma justificativa.
7. Consulte o histórico para verificar todas as alterações.

## Observações

- A capacidade mensal pertence exclusivamente ao cadastro do juiz na resposta do formulário. A quantidade de cada solicitação vem da resposta do solicitante à nova pergunta do formulário; ela é somada somente enquanto a solicitação estiver ativa e designada.
- A aba `Juízes Leigos Disponíveis` é uma visão derivada da origem. Não edite, exclua nem reordene suas linhas para corrigir cadastros; atualize a resposta original ou use a aba Administração do site. Em cópias importadas que mantêm uma tabela com uma coluna excedente, o instalador deixa `COLUNA_AUXILIAR_LEGADA` somente no final para satisfazer a exigência de cabeçalho não vazio; ela não participa da fórmula nem do cálculo.
- A capacidade declarada do juiz aceita inteiro não negativo. Em solicitações, quantidades informadas devem ser inteiros positivos; solicitações antigas sem quantidade não reduzem a carga conhecida, aparecem como carga parcial e não invalidam a capacidade do juiz. A interface identifica esse caso como “Quantidade não informada”, reservando “Revisar quantidade” para valores preenchidos de forma inválida. Valores ambíguos exigem correção na origem, e uma nova designação continua exigindo quantidade positiva.
- Ao designar ou reabrir uma solicitação atribuída, deve existir uma quantidade positiva informada pelo solicitante; o gestor não pode preenchê-la. O campo pode permanecer vazio durante a conferência de registros legados; nesse caso o pedido não entra no saldo conhecido e não pode ser designado/reaberto até ser conferido.
- Designações acima da capacidade continuam possíveis, mas exigem confirmação e justificativa.
- Notificações são enviadas apenas para endereços do domínio institucional.
- O sistema espera os 17 cabeçalhos originais da planilha fornecida. Não remova nem mova a coluna `Número de minutas em que necessita trabalhar no mês atual:`: em registros de juiz ela continua sendo a capacidade mensal. A nova pergunta gera sua própria coluna na aba de respostas. `QUANTIDADE_MINUTAS` na gestão é legada e não deve ser copiada para a resposta do solicitante.
- Links permanecem no navegador; nenhuma chave do AppSheet é usada ou exposta.
- Antes da produção, realize um piloto com dados não sensíveis e submeta o sistema à TI/Segurança da Informação do TJES.

## Testes locais

```sh
node tests/smoke.js
node tests/regression.js
node tests/maintenance.js
node tests/integrity.js
node tests/ui.js
```

A interface é testada com DOM simulado. Para conferir o layout com dados fictícios, execute `node tests/preview.js` e abra `http://127.0.0.1:4173`. A prévia não grava dados e não substitui a homologação do Apps Script. Não copie arquivos de `tests` para o Apps Script.
