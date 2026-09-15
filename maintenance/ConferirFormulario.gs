// Somente no projeto separado de manutenção, junto de PrepararPlanilha.gs.
// Nunca publicar como Web App nem copiar para src/.
var JL_PERGUNTA_QUANTIDADE = 'Quantas minutas estão sendo solicitadas?';

function contextoFormulario_() {
  const email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  const admins = propriedadeObrigatoria_('ADMIN_EMAILS').split(/[;,\n]+/).map(x => x.trim().toLowerCase());
  if (!email || !email.endsWith('@' + dominioInstitucional_()) || !admins.includes(email)) {
    throw new Error('A conta executora deve ser institucional e estar em ADMIN_EMAILS neste projeto de manutenção.');
  }
  const livro = SpreadsheetApp.openById(propriedadeObrigatoria_('SPREADSHEET_ID'));
  const nome = PropertiesService.getScriptProperties().getProperty('SOURCE_SHEET') || JL_CONFIG.SOURCE_SHEET;
  const aba = livro.getSheetByName(nome);
  if (!aba) throw new Error('Aba de origem não encontrada.');
  const url = aba.getFormUrl();
  if (!url) throw new Error('Esta aba não está vinculada a um Google Forms. Confira a origem do site e do formulário.');
  const form = FormApp.openByUrl(url);
  if (form.getDestinationId() !== livro.getId()) throw new Error('O formulário aponta para outra planilha.');
  return {livro:livro, aba:aba, form:form, email:email};
}

function diagnosticarFormulario() {
  const c = contextoFormulario_();
  const perguntas = c.form.getItems().map(item => ({id:item.getId(), titulo:item.getTitle(), tipo:String(item.getType())}));
  const quantidades = perguntas.filter(item => item.titulo.trim() === JL_PERGUNTA_QUANTIDADE);
  const cabecalhos = c.aba.getRange(1,1,1,c.aba.getLastColumn()).getDisplayValues()[0].map(x => String(x).trim());
  const resultado = {perguntas:perguntas, perguntasQuantidade:quantidades.length,
    colunaQuantidade: cabecalhos.indexOf(JL_PERGUNTA_QUANTIDADE)+1,
    orientacao: 'Magistrados e assessores devem passar pela mesma pergunta obrigatória de quantidade. A capacidade mensal pertence somente ao cadastro de Juiz Leigo. Confira o direcionamento das seções no editor do Forms.'};
  console.log(JSON.stringify(resultado));
  return resultado;
}

function planoRecuperacaoQuantidade_(c) {
  const itens = c.form.getItems().filter(item => item.getTitle().trim() === JL_PERGUNTA_QUANTIDADE);
  if (itens.length !== 1) throw new Error('Deve existir exatamente uma pergunta: ' + JL_PERGUNTA_QUANTIDADE + ' Confira docs/QUANTIDADE_SOLICITANTE.md.');
  const linhas = c.aba.getDataRange().getValues();
  const titulos = linhas[0].map(x => String(x).trim());
  function coluna(titulo) {
    const i = titulos.indexOf(titulo);
    if (i < 0 || i !== titulos.lastIndexOf(titulo)) throw new Error('Cabeçalho ausente ou duplicado: ' + titulo + '. Envie uma resposta de teste pelo Forms e confira a vinculação.');
    return i;
  }
  const idCol = coluna('FORM_RESPONSE_ID'), qCol = coluna(JL_PERGUNTA_QUANTIDADE), cargoCol = coluna('Cargo ou Função:');
  const porId = {};
  linhas.slice(1).forEach((linha,i) => {
    const id = String(linha[idCol] || '').trim();
    if (!id) return;
    if (porId[id]) throw new Error('FORM_RESPONSE_ID duplicado na origem. Nenhuma quantidade foi alterada.');
    porId[id] = {linha:i+2, valores:linha};
  });
  const plano = [], resumo = {recuperaveis:0, semVinculo:0, semQuantidade:0, divergentes:0};
  c.form.getResponses().forEach(resposta => {
    const registro = porId[String(resposta.getId())];
    if (!registro) {resumo.semVinculo++;return;}
    if (!/magistrad|assessor/i.test(String(registro.valores[cargoCol]))) return;
    const item = resposta.getResponseForItem(itens[0]);
    const texto = item ? String(item.getResponse()).trim() : '';
    if (!/^[1-9][0-9]*$/.test(texto) || !Number.isSafeInteger(Number(texto))) {resumo.semQuantidade++;return;}
    const atual = String(registro.valores[qCol] == null ? '' : registro.valores[qCol]).trim();
    if (atual) {if (Number(atual) !== Number(texto)) resumo.divergentes++;return;}
    plano.push({linha:registro.linha,coluna:qCol+1,quantidade:Number(texto),responseId:String(resposta.getId())});
  });
  resumo.recuperaveis = plano.length;
  return {plano:plano,resumo:resumo};
}

function conferirQuantidadesFormulario() {
  const resultado = planoRecuperacaoQuantidade_(contextoFormulario_());
  console.log(JSON.stringify(resultado.resumo));
  return resultado.resumo;
}

function recuperarQuantidadesFormulario() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const c = contextoFormulario_();
    const resultado = planoRecuperacaoQuantidade_(c);
    const auditoria = c.livro.getSheetByName('AUDITORIA');
    if (!auditoria) throw new Error('Execute prepararPlanilha antes da recuperação.');
    resultado.plano.forEach(item => {
      const celula = c.aba.getRange(item.linha,item.coluna);
      if (celula.getValue() !== '') throw new Error('A origem mudou durante a recuperação. Execute a conferência novamente.');
      celula.setValue(item.quantidade);
      auditoria.appendRow([new Date(),c.email,'ADMIN','RECUPERAR_QUANTIDADE_FORMULARIO',item.linha,
        JSON.stringify({quantidade:''}),JSON.stringify({quantidade:item.quantidade,formResponseId:item.responseId})]);
    });
    SpreadsheetApp.flush();
    console.log(JSON.stringify(resultado.resumo));
    return resultado.resumo;
  } finally {lock.releaseLock();}
}
