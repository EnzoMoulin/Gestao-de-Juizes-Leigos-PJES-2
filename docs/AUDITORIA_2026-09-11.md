# Auditoria técnica do Conecta Jules

Data: 11 de setembro de 2026  
Projeto: PJES — Gestão de Juízes Leigos  
Base examinada: `072ca67fd793f0a742da49656931d9c1df8190c1`, ramo `main`  
Repositório: https://github.com/actualrat1984/Gestao-de-Juizes-Leigos-PJES  
Versão candidata: `2026.09.11` — ramo local `feat/auditoria-ui-conecta-jules`

## Resultado

A revisão confirmou riscos no controle de edições simultâneas, no tratamento de quantidades e na reabertura de solicitações. A versão candidata corrige esses caminhos e acrescenta recursos para localizar, revisar e imprimir a fila de trabalho. As cinco suítes locais passaram; duas delas são novas e abrangem 24 cenários de integridade e interface.

**A candidata está preparada para revisão e homologação. Não foi aplicada ao GitHub remoto, ao Apps Script ou à planilha de produção.** A conexão GitHub informou `pull: true` e `push: false`; por isso, as alterações são entregues como pacote e patch. A validação visual não foi concluída: o navegador de revisão bloqueou a abertura da prévia pela política de URLs. O teste de interface usou DOM simulado e não comprova aparência ou acessibilidade integral.

Permanecem riscos de associação por linha/nome e gravação parcial entre abas. Eles precisam de tratamento antes de uma expansão de uso institucional. Esta auditoria é técnica e não constitui homologação administrativa, parecer jurídico ou certificação de segurança.

## Escopo e evidências

Foram examinados todos os arquivos de `src`, o manifesto, os testes existentes, a manutenção, o README e a auditoria anterior. A proposta anexada `Conecta_Jules_Proposta_Institucional.docx` foi lida como referência de finalidade, funcionalidades e riscos. Ela descreve a mesma revisão base do repositório.

O Google Drive foi pesquisado pelos termos “Jules” e “Juízes”. Não foi localizado documento complementar do Conecta Jules nessas buscas; os resultados de contatos PJES pertenciam a outro sistema e não foram usados como fonte desta auditoria. Nenhuma planilha foi editada.

Não foram inspecionados: propriedades privadas, configuração real da implantação, respostas reais do formulário, permissões efetivas de compartilhamento, entregas de e-mail, quotas em carga ou restauração de backup. Os testes usam exclusivamente dados fictícios e serviços simulados.

## Achados e tratamento

| ID | Prioridade | Evidência na base | Consequência | Tratamento nesta candidata |
|---|---|---|---|---|
| A01 | Alta | `Data.gs`, `atualizarSolicitacao_` e `designarJuiz_`: bloqueio de escrita sem comparação da edição aberta | A segunda pessoa pode sobrescrever dados que mudaram desde a leitura | Corrigido nos dois endpoints por versão calculada e comparação dentro do bloqueio, antes de gravar |
| A02 | Alta | `atualizarSolicitacao_` aceita transição de encerrado para ativo sem verificar carga | A reabertura pode exceder a capacidade sem confirmação | Corrigido: recalcula a carga do juiz já atribuído e exige confirmação booleana e justificativa para excesso |
| A03 | Alta | `Management.gs`, `numeroQuantidade_`: extrai o primeiro número de texto livre e remove pontos | Negativos, intervalos e frações podem ser interpretados como outra quantidade | Corrigido: análise restrita de inteiros; dados ambíguos impedem novas designações e reaberturas que dependam deles |
| A04 | Média | `listarDados_`, `apiBootstrap` e `renderJudges`: capacidade desconhecida pode aparecer como disponível | O painel sugere saldo que não foi validado | Corrigido: indicador exclui capacidade/status/carga inválidos e nomes duplicados; UI apresenta “Revisar cadastro” |
| A05 | Média | `index.html`: ausência de meta viewport; tipografia pequena e oito indicadores antes da fila | Leitura e operação prejudicadas em telas pequenas | Adicionados viewport, controles e textos maiores, quatro indicadores principais, layout responsivo e lista compacta; inspeção visual pendente |
| A06 | Média | `renderRequests`: renderiza todos os cartões a cada filtro | Listas extensas aumentam o tamanho do DOM | Adicionada paginação de 10, 25 ou 50 registros; backend continua lendo a base integralmente |
| A07 | Alta | Gestão e histórico identificam solicitações pelo número da linha | Ordenar, excluir ou mover linhas pode associar dados à pessoa/pedido errado | **Pendente**: migrar para IDs permanentes com backup, reconciliação e validação dos vínculos |
| A08 | Alta | Origem, gestão e auditoria são gravadas em operações separadas | Falha intermediária pode deixar estado parcial; repetir pode duplicar efeitos | **Pendente**: definir recuperação, idempotência e conciliação; não foi acrescentada repetição automática |
| A09 | Média | Juiz associado pelo nome; falta de competência mensal explícita | Renomeações ou cadastros de períodos diferentes podem distorcer carga | Duplicidade conhecida bloqueia designação; IDs e competência mensal continuam pendentes |
| A10 | Média | Acessos fixos e cadastro USUARIOS coexistem; auditoria é uma aba editável | Revogação incompleta e alterações fora da trilha da aplicação | **Pendente operacional**: revisar ambas as fontes de acesso, proteção de abas, custódia e retenção |
| A11 | Média | CONSULTA recebe lista de juízes, matérias, observações e carga agregada; histórico inclui autor e alterações | Visibilidade pode ser mais ampla que a política institucional pretendida | **Decisão pendente**: validar minimização e visibilidade complementar; escopo existente foi preservado |

Prioridade expressa impacto técnico potencial, não comprovação de incidente. A correção de A01 reduz sobrescritas pelos caminhos da aplicação; não transforma posições de linha em identidades permanentes nem impede edição manual concorrente na planilha.

## Correções de integridade

### Edições simultâneas

Cada solicitação recebe `versao`, uma impressão SHA-256 dos valores brutos, valores exibidos e metadados de gestão. O navegador envia essa versão na designação e na atualização de andamento. O servidor compara a versão dentro de `LockService`, antes de qualquer escrita. A inclusão das duas representações evita aceitar silenciosamente uma leitura de exibição antiga combinada com valores brutos novos.

Se a versão estiver ausente ou diferente, o servidor recusa a gravação. O formulário continua aberto com o texto da pessoa, e orienta copiar as observações antes de fechar, atualizar e conferir a versão atual. Clientes antigos precisam recarregar a aplicação; não existe fallback que permita gravar sem versão.

O controle não inclui a versão do cadastro de usuários. Também não oferece transação com alterações manuais do Sheets, que não respeitam o bloqueio do script. O saneamento e a proteção da origem permanecem necessários.

### Capacidade e reabertura

A designação e a reabertura que devolve carga ao juiz usam a mesma validação no servidor. A carga projetada exclui a própria solicitação antes de somá-la, evitando contagem dupla em uma redesignação para o mesmo juiz. A reabertura verifica o juiz atualmente atribuído, independentemente de outra seleção no formulário de designação.

Uma exceção exige `permitirExcesso === true` e justificativa de 5 a 500 caracteres, registrada na auditoria. Texto como `"false"` não é aceito como confirmação. Iniciar “Em atendimento” sem juiz atribuído é bloqueado; o operador deve usar a designação.

| Entrada | Interpretação |
|---|---|
| `20`, `20 minutas`, `20 minuta` | 20 |
| `1.000`, `1.000 minutas` | 1000, agrupamento brasileiro |
| `0` | Capacidade conhecida sem saldo; quantidade de solicitação não pode ser zero |
| `-20`, `10,5`, `1.5`, `20 a 30`, `cerca de 20` | Requer revisão na origem |
| Vazio ou número maior que o inteiro seguro do JavaScript | Requer revisão na origem |

Os valores originais são preservados para consulta. Nenhum formulário ou cadastro real foi convertido automaticamente. Quantidade inválida em outra solicitação ativa do mesmo juiz impede calcular nova carga. Valores parcialmente somados podem permanecer visíveis como referência, mas o saldo fica indisponível e o cadastro sai da contagem de disponíveis.

### Sessão e respostas assíncronas

A saída limpa o token local, dados em memória e conteúdo do relatório, e fecha diálogos antes da resposta do servidor. Resultados atrasados de bootstrap, usuários e histórico são descartados quando pertencem a outra sessão. A revisão manteve a autenticação Workspace, a autorização no servidor e os perfis existentes.

## Novos recursos e interface

| Recurso | Comportamento |
|---|---|
| Lista compacta | Alternativa aos cartões com unidade, situação, juiz, quantidade, prazo e ações; preferência visual local sem armazenar registros |
| Paginação | 10, 25 ou 50 itens; filtros reiniciam na primeira página; releitura automática preserva a página quando possível |
| Busca sem acentos | “vitoria” localiza “Vitória”; pesquisa campos operacionais, incluindo processos já autorizados para o perfil |
| Prazos próximos | Inclui hoje e os próximos sete dias corridos, usando o dia informado pelo servidor; exclui concluídas e canceladas |
| Relatório para impressão | Usa todos os resultados dos filtros, incluindo páginas não visíveis; apresenta data da leitura, filtros e perfil |
| Exportação CSV | Continua usando todos os resultados filtrados, com escape e proteção contra fórmulas |
| Revisão de cadastro | Distingue capacidade ou carga desconhecida de disponibilidade confirmada |
| Usabilidade | Cabeçalho mais curto, quatro indicadores principais, alertas acionáveis, diálogos nomeados, atalho de teclado para a fila, região de tabela rolável e preferência por movimento reduzido |

O relatório impresso não acrescenta campos de processos, e-mails ou observações à listagem. A saída é preparada no navegador; não há geração automática ou envio de documentos. O usuário pode usar a opção de salvar como PDF do próprio diálogo de impressão após homologação desse fluxo no Apps Script.

## Validação executada

| Verificação | Resultado | Limite |
|---|---|---|
| `node tests/smoke.js` | Aprovado | Mocks e verificações estruturais existentes |
| `node tests/regression.js` | Aprovado | Sessões, origem, funções, datas e conteúdo seguro com mocks |
| `node tests/maintenance.js` | Aprovado | Manutenção e autorização em ambiente simulado |
| `node tests/integrity.js` | 15 cenários aprovados | Sheets/cache simulados; sem escrita externa |
| `node tests/ui.js` | 9 cenários aprovados | DOM simulado; sem navegador gráfico |
| IDs e referências da UI | Aprovados | IDs únicos e seletores existentes |
| `git diff --check` | Aprovado | Integridade textual do diff |
| Navegador desktop/celular | **Não executado até o fim** | Prévia bloqueada pela política de acesso do navegador de revisão |
| Google Workspace real | **Não executado** | Sem implantação ou planilha de homologação conectada |

A suíte de integridade verifica sobrecarga, justificativa, confirmação estrita, edições concorrentes, alteração direta de origem/metadados, cliente sem versão, texto ambíguo, carga desconhecida, capacidade zero, nomes duplicados, contagem de redesignação e bloqueio de escrita para CONSULTA.

A suíte de UI verifica paginação, manutenção de página, lista compacta, busca, ausência de resultados, limites do filtro de prazo, relatório completo com escape, ocultação de ações para CONSULTA, prévia de reabertura, transmissão de versão/confirmação e limpeza na saída.

## Aplicação da candidata

1. Conferir o pacote contra a revisão base e eventuais mudanças locais posteriores. O patch não deve sobrescrever trabalho concorrente.
2. Fazer backup da planilha, do código, das configurações e da identificação da implantação atual.
3. Em checkout da revisão base, executar `git apply --check Conecta_Jules_2026-09-11.patch`. Aplicar com `git apply` somente após o check passar. Alternativamente, revisar os arquivos completos no pacote.
4. Executar as cinco suítes de teste na raiz do projeto.
5. Atualizar **todos os arquivos de `src` juntos** no Apps Script de homologação. O cliente e os endpoints mudaram juntos; não atualizar somente o HTML ou somente o servidor.
6. Manter o `.clasp.json` privado existente com o ID correto. O pacote não inclui credenciais, IDs reais de implantação nem propriedades privadas. `clasp push` atualiza o código do projeto, mas a URL `/exec` exige nova versão da implantação.
7. Homologar com dados fictícios e, depois, base apropriada: dois gestores editando o mesmo pedido; reabertura com/sem excesso; quantidades inválidas; CONSULTA e conta externa; timeout; CSV; impressão; teclado; leitor de tela; desktop/celular e ampliação de 200%.
8. Só depois dos testes, publicar a versão aprovada conforme o procedimento do responsável pelo ambiente. Orientar usuários a recarregar telas antigas.

Não há migração de schema nesta candidata. O comando de instalação de estruturas auxiliares não precisa ser reexecutado apenas pelas mudanças de UI e integridade quando as abas atuais já estão corretas.

### Prévia local

`Previa_Conecta_Jules.html` abre uma demonstração isolada com registros fictícios e gravações desativadas. Também pode ser regenerada por `node tests/preview.js --export arquivo.html` ou servida localmente com `node tests/preview.js`. A demonstração substitui a impressão por exibição do relatório na própria página para facilitar a conferência. Não mede dados reais e não deve ser copiada para `src` ou usada como aplicação oficial.

### Reversão

Restaurar o conjunto anterior de arquivos e selecionar a implantação anterior seguindo o procedimento de backup. Recarregar os navegadores. Como esta candidata não migra colunas, não exige reversão de schema; eventuais operações feitas durante a homologação devem ser conciliadas com a planilha e a auditoria, sem apagar histórico indiscriminadamente.

## Próximas prioridades

1. Migrar solicitações e juízes para IDs permanentes, com validação de unicidade e plano de reconciliação dos registros históricos.
2. Implantar identificação de operações, recuperação de gravações parciais e conciliação, antes de qualquer repetição automática após timeout.
3. Definir competência mensal e regras de capacidade por período, preservando histórico de vigências.
4. Homologar a visibilidade de campos por perfil, revisar acessos fixos e compartilhamento direto, testar restauração e medir limites de volume.

Essas prioridades requerem decisões e evidências do ambiente real. Não foram apresentadas como funcionalidades prontas nesta entrega.
