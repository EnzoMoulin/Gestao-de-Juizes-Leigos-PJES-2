function abrirPlanilha_() {
  return SpreadsheetApp.openById(propriedadeObrigatoria_(JL_CONFIG.PROPERTIES.SPREADSHEET_ID));
}

function obterFonte_() {
  const nome = String(PropertiesService.getScriptProperties().getProperty("SOURCE_SHEET") || JL_CONFIG.SOURCE_SHEET).trim();
  const aba = abrirPlanilha_().getSheetByName(nome);
  if (!aba) throw new Error("Aba de origem não encontrada: " + nome + ".");
  return aba;
}

function mapaCabecalhos_(aba) {
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const mapa = {};
  cabecalhos.forEach((valor, indice) => { const titulo = String(valor).trim(); if (titulo && mapa[titulo] !== undefined) throw new Error("Cabeçalho duplicado: " + titulo); mapa[titulo] = indice; });
  Object.keys(JL_CONFIG.HEADERS).forEach(chave => {
    const titulo = JL_CONFIG.HEADERS[chave];
    if (mapa[titulo] === undefined) throw new Error("Cabeçalho obrigatório ausente: " + titulo);
  });
  return mapa;
}

function valor_(linha, mapa, chave) {
  return linha[mapa[JL_CONFIG.HEADERS[chave]]];
}

function campoPreenchido_(valor) {
  return String(valor == null ? "" : valor).trim() !== "";
}

function ehSolicitacao_(linha, mapa) {
  const cargo = normalizarNome_(valor_(linha, mapa, "FUNCTION"));
  return cargo.includes("magistrad") || cargo.includes("assessor");
}

function ehJuizLeigo_(linha, mapa) {
  const cargo = normalizarNome_(valor_(linha, mapa, "FUNCTION"));
  return /\bjuiz(?:a|es|as)? leig[oa]s?\b/.test(cargo);
}

function statusNormalizado_(valor) {
  const status = String(valor || "Pendente").trim() || "Pendente";
  return JL_CONFIG.STATUS.find(item => normalizarNome_(item) === normalizarNome_(status)) || status;
}

function statusFinal_(status) {
  return status === "Concluído" || status === "Cancelado";
}

function versaoJuiz_(linhaBruta, numeroLinha, linhaExibida) {
  return hashToken_(JSON.stringify({ linha: linhaBruta, origem: numeroLinha, exibicao: linhaExibida }));
}

function exigirVersaoJuiz_(versaoEsperada, linhaBruta, numeroLinha, linhaExibida) {
  if (!versaoEsperada || versaoEsperada !== versaoJuiz_(linhaBruta, numeroLinha, linhaExibida)) {
    throw new Error("Este cadastro de juiz foi alterado ou a tela está desatualizada. Atualize os dados e confira as mudanças antes de salvar novamente.");
  }
}

function cadastroJuizDaLinha_(linhaExibida, linhaBruta, mapa, numeroLinha) {
  const capacidade = valor_(linhaExibida, mapa, "CAPACITY");
  const status = statusNormalizado_(valor_(linhaExibida, mapa, "STATUS"));
  return {
    id: numeroLinha,
    versao: versaoJuiz_(linhaBruta, numeroLinha, linhaExibida),
    nome: valor_(linhaExibida, mapa, "NAME"),
    email: normalizarEmail_(valor_(linhaExibida, mapa, "EMAIL")),
    telefone: valor_(linhaExibida, mapa, "PHONE"),
    capacidade: capacidade,
    capacidadeNumerica: numeroQuantidade_(capacidade),
    capacidadeValida: quantidadeInteira_(capacidade) !== null,
    materias: valor_(linhaExibida, mapa, "SUBJECTS"),
    observacoes: valor_(linhaExibida, mapa, "PRODUCTIVITY"),
    status: status,
    statusValido: JL_CONFIG.STATUS.includes(status),
    ativo: !statusFinal_(status)
  };
}

function solicitacaoDaLinha_(linhaExibida, linhaBruta, mapa, numeroLinha, metadados, gerente) {
  const status = statusNormalizado_(valor_(linhaExibida, mapa, "STATUS"));
  const criadoEm = valor_(linhaBruta, mapa, "TIMESTAMP");
  const gestao = metadados[numeroLinha] || { prioridade: "Normal", prazo: "", atualizadoEm: "", atualizadoPor: "" };
  const hoje = dataIso_(new Date());
  const quantidade = valor_(linhaExibida, mapa, "CAPACITY");
  const quantidadeNumerica = numeroQuantidade_(quantidade);
  return {
    id: numeroLinha,
    versao: versaoSolicitacao_(linhaBruta, numeroLinha, metadados, linhaExibida),
    quantidadeInformada: campoPreenchido_(quantidade),
    quantidadeValida: quantidadeInteira_(quantidade) > 0,
    data: valor_(linhaExibida, mapa, "TIMESTAMP"),
    dataIso: criadoEm instanceof Date ? criadoEm.toISOString() : "",
    diasEspera: diasDesde_(criadoEm),
    solicitante: valor_(linhaExibida, mapa, "NAME"),
    email: normalizarEmail_(valor_(linhaExibida, mapa, "EMAIL")),
    unidade: valor_(linhaExibida, mapa, "UNIT"),
    quantidade: quantidade,
    quantidadeNumerica: quantidadeNumerica,
    competencias: valor_(linhaExibida, mapa, "SKILLS") || valor_(linhaExibida, mapa, "SUBJECTS"),
    preferencia: valor_(linhaExibida, mapa, "PREFERRED_JUDGE"),
    status: status,
    juiz: valor_(linhaExibida, mapa, "ASSIGNED_JUDGE"),
    dataDesignacao: valor_(linhaExibida, mapa, "ASSIGNED_AT"),
    observacoes: valor_(linhaExibida, mapa, "NOTES"),
    prioridade: gestao.prioridade || "Normal",
    prazo: gestao.prazo || "",
    atrasada: Boolean(gestao.prazo && gestao.prazo < hoje && !statusFinal_(status)),
    atualizadoEm: gestao.atualizadoEm || "",
    atualizadoPor: gestao.atualizadoPor || "",
    detalhes: gerente ? {
      email: normalizarEmail_(valor_(linhaExibida, mapa, "EMAIL")),
      telefone: valor_(linhaExibida, mapa, "PHONE"),
      processos: valor_(linhaExibida, mapa, "CASES"),
      orientacoes: valor_(linhaExibida, mapa, "GUIDANCE"),
      produtividade: valor_(linhaExibida, mapa, "PRODUCTIVITY")
    } : null
  };
}

function listarDados_(usuario) {
  const aba = obterFonte_();
  const mapa = mapaCabecalhos_(aba);
  const quantidadeLinhas = Math.max(aba.getLastRow() - 1, 0);
  const linhasExibidas = quantidadeLinhas ? aba.getRange(2, 1, quantidadeLinhas, aba.getLastColumn()).getDisplayValues() : [];
  const linhasBrutas = quantidadeLinhas ? aba.getRange(2, 1, quantidadeLinhas, aba.getLastColumn()).getValues() : [];
  const gerente = podeGerenciar_(usuario);
  const metadados = obterMetadadosGestao_();
  const todasSolicitacoes = [];
  const juizes = [];
  let respostas = 0, juizesEncerrados = 0;
  const ignoradas = [], statusDesconhecidos = [];

  linhasExibidas.forEach((linha, indice) => {
    const numeroLinha = indice + 2;
    if (!linha.some(valor => String(valor).trim())) return;
    respostas++;
    if (!ehSolicitacao_(linha, mapa) && !ehJuizLeigo_(linha, mapa)) ignoradas.push({linha: numeroLinha, cargo: String(valor_(linha, mapa, "FUNCTION") || "(vazio)")});
    if (!JL_CONFIG.STATUS.includes(statusNormalizado_(valor_(linha, mapa, "STATUS")))) statusDesconhecidos.push(numeroLinha);
    if (ehJuizLeigo_(linha, mapa) && statusFinal_(statusNormalizado_(valor_(linha, mapa, "STATUS")))) juizesEncerrados++;
    if (ehSolicitacao_(linha, mapa)) {
      todasSolicitacoes.push(solicitacaoDaLinha_(linha, linhasBrutas[indice], mapa, numeroLinha, metadados, gerente));
    }
    if (ehJuizLeigo_(linha, mapa) && !statusFinal_(statusNormalizado_(valor_(linha, mapa, "STATUS")))) {
      const cadastro = cadastroJuizDaLinha_(linha, linhasBrutas[indice], mapa, numeroLinha);
      juizes.push(Object.assign(cadastro, {
        contato: gerente ? { email: valor_(linha, mapa, "EMAIL"), telefone: valor_(linha, mapa, "PHONE") } : null
      }));
    }
  });

  juizes.forEach(juiz => {
    const chave = normalizarNome_(juiz.nome);
    const atribuidas = todasSolicitacoes.filter(item => !statusFinal_(item.status) && normalizarNome_(item.juiz) === chave);
    const quantidadesAusentes = atribuidas.filter(item => !item.quantidadeInformada);
    const quantidadesInvalidas = atribuidas.filter(item => item.quantidadeInformada && !item.quantidadeValida);
    juiz.designadas = atribuidas.reduce((total, item) => total + item.quantidadeNumerica, 0);
    juiz.cargaConfiavel = quantidadesAusentes.length === 0 && quantidadesInvalidas.length === 0;
    juiz.cargaParcial = quantidadesAusentes.length > 0;
    juiz.quantidadesAtribuidasAusentes = quantidadesAusentes.map(item => item.id);
    juiz.quantidadesAtribuidasInvalidas = quantidadesInvalidas.map(item => item.id);
    juiz.nomeDuplicado = juizes.filter(item => normalizarNome_(item.nome) === chave).length > 1;
    // Uma solicitação antiga pode não ter informado a quantidade de minutas.
    // Isso deixa a carga parcial, mas não invalida a capacidade declarada do juiz.
    // Valores preenchidos e inválidos continuam exigindo correção da origem.
    juiz.requerRevisao = !juiz.capacidadeValida || !juiz.statusValido || quantidadesInvalidas.length > 0 || juiz.nomeDuplicado;
    juiz.disponiveis = !juiz.requerRevisao ? Math.max(juiz.capacidadeNumerica - juiz.designadas, 0) : null;
    juiz.percentualOcupacao = juiz.capacidadeNumerica > 0 ? Math.min(100, Math.round(juiz.designadas / juiz.capacidadeNumerica * 100)) : 0;
    juiz.lotado = juiz.capacidadeValida && juiz.designadas >= juiz.capacidadeNumerica;
    delete juiz.email;
    delete juiz.telefone;
  });

  const solicitacoes = gerente ? todasSolicitacoes : todasSolicitacoes.filter(item => item.email === normalizarEmail_(usuario.email));
  solicitacoes.sort((a, b) => {
    const ordem = { Urgente: 0, Alta: 1, Normal: 2 };
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    if (ordem[a.prioridade] !== ordem[b.prioridade]) return ordem[a.prioridade] - ordem[b.prioridade];
    return b.id - a.id;
  });
  juizes.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const planilha = gerente ? abrirPlanilha_() : null;
  const fonte = gerente ? {
    planilha: planilha.getName(), id: planilha.getId(), aba: aba.getName(),
    url: planilha.getUrl() + "#gid=" + aba.getSheetId(),
    respostas: respostas, solicitacoes: todasSolicitacoes.length, juizesAtivos: juizes.length,
    juizesEncerrados: juizesEncerrados, ignoradas: ignoradas.slice(0, 20),
    totalIgnoradas: ignoradas.length, statusDesconhecidos: statusDesconhecidos.slice(0, 20),
    ultimaLinha: aba.getLastRow()
  } : null;
  return { solicitacoes: solicitacoes, todasSolicitacoes: todasSolicitacoes, juizes: juizes, fonte: fonte };
}

function listarCadastrosJuizes_() {
  const aba = obterFonte_();
  const mapa = mapaCabecalhos_(aba);
  const quantidadeLinhas = Math.max(aba.getLastRow() - 1, 0);
  const linhasExibidas = quantidadeLinhas ? aba.getRange(2, 1, quantidadeLinhas, aba.getLastColumn()).getDisplayValues() : [];
  const linhasBrutas = quantidadeLinhas ? aba.getRange(2, 1, quantidadeLinhas, aba.getLastColumn()).getValues() : [];
  const cadastros = [];
  linhasExibidas.forEach((linha, indice) => {
    const numeroLinha = indice + 2;
    if (!linha.some(valor => String(valor).trim()) || !ehJuizLeigo_(linha, mapa)) return;
    cadastros.push(cadastroJuizDaLinha_(linha, linhasBrutas[indice], mapa, numeroLinha));
  });
  cadastros.forEach(cadastro => {
    const chave = normalizarNome_(cadastro.nome);
    cadastro.nomeDuplicado = cadastros.filter(item => normalizarNome_(item.nome) === chave && !statusFinal_(item.status)).length > 1;
  });
  return cadastros.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

function escreverCampo_(aba, mapa, numeroLinha, chave, valor) {
  aba.getRange(numeroLinha, mapa[JL_CONFIG.HEADERS[chave]] + 1).setValue(valor);
}

function textoCelulaSeguro_(valor) {
  const texto = String(valor || "");
  return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
}

function validarLinha_(aba, numeroLinha) {
  const linha = Number(numeroLinha);
  if (!Number.isInteger(linha) || linha < 2 || linha > aba.getLastRow()) throw new Error("Solicitação inválida.");
  return linha;
}

function registrarAuditoria_(usuario, acao, linha, antes, depois) {
  const planilha = abrirPlanilha_();
  let aba = planilha.getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!aba) aba = planilha.insertSheet(JL_CONFIG.AUDIT_SHEET);
  if (aba.getLastRow() === 0) aba.appendRow(["DATA_HORA", "EMAIL", "PERFIL", "ACAO", "LINHA_ORIGEM", "ANTES", "DEPOIS"]);
  aba.appendRow([new Date(), usuario.email, usuario.perfil, acao, linha, JSON.stringify(antes || {}), JSON.stringify(depois || {})]);
}

function designarJuiz_(usuario, numeroLinha, nomeJuiz, justificativaExcesso, permitirExcesso, prioridade, prazo, versaoEsperada) {
  const nome = String(nomeJuiz || "").trim();
  const justificativa = String(justificativaExcesso || "").trim();
  if (!nome || nome.length > 150) throw new Error("Selecione uma juíza ou um juiz leigo válido.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let notificacao = null;
  try {
    const aba = obterFonte_();
    const linha = validarLinha_(aba, numeroLinha);
    const mapa = mapaCabecalhos_(aba);
    const atual = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    const atualBruta = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
    if (!ehSolicitacao_(atual, mapa)) throw new Error("A linha selecionada não é uma solicitação.");

    const dados = listarDados_(usuario);
    validarGestao_(prioridade, prazo);
    exigirVersaoSolicitacao_(versaoEsperada, atualBruta, linha, obterMetadadosGestao_(), atual);
    const verificacao = validarCapacidadeDesignacao_(dados, linha, nome,
      quantidadeInteira_(valor_(atual, mapa, "CAPACITY")), justificativa, permitirExcesso);
    const juiz = verificacao.juiz;
    const excede = verificacao.excede;

    const antes = { juiz: valor_(atual, mapa, "ASSIGNED_JUDGE"), status: valor_(atual, mapa, "STATUS") };
    escreverCampo_(aba, mapa, linha, "ASSIGNED_JUDGE", textoCelulaSeguro_(nome));
    escreverCampo_(aba, mapa, linha, "ASSIGNED_AT", new Date());
    escreverCampo_(aba, mapa, linha, "STATUS", "Em atendimento");
    const alteracaoGestao = salvarMetadadosGestao_(usuario, linha, prioridade, prazo);
    const depois = { juiz: nome, status: "Em atendimento", justificativaExcesso: excede ? justificativa : "" };
    registrarAuditoria_(usuario, antes.juiz && normalizarNome_(antes.juiz) !== normalizarNome_(nome) ? "REDESIGNAR_JUIZ" : "DESIGNAR_JUIZ", linha,
      Object.assign({}, antes, alteracaoGestao.antes), Object.assign({}, depois, alteracaoGestao.depois));
    SpreadsheetApp.flush();

    const solicitacao = solicitacaoDaLinha_(atual, atualBruta, mapa, linha, obterMetadadosGestao_(), true);
    const contatoJuiz = aba.getRange(juiz.id, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    notificacao = notificarDesignacao_(solicitacao, { nome: nome, email: valor_(contatoJuiz, mapa, "EMAIL") }, usuario);
    return { ok: true, notificacao: notificacao, excedeuCapacidade: excede };
  } finally {
    lock.releaseLock();
  }
}

function atualizarSolicitacao_(usuario, numeroLinha, status, observacoes, prioridade, prazo, versaoEsperada, justificativaExcesso, permitirExcesso) {
  const novoStatus = String(status || "").trim();
  if (!JL_CONFIG.STATUS.includes(novoStatus)) throw new Error("Status inválido.");
  const notas = String(observacoes || "").trim();
  if (notas.length > 4000) throw new Error("As observações devem ter no máximo 4.000 caracteres.");
  if (statusFinal_(novoStatus) && notas.length < 5) throw new Error("Informe uma observação ao concluir ou cancelar uma solicitação.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = obterFonte_();
    const linha = validarLinha_(aba, numeroLinha);
    const mapa = mapaCabecalhos_(aba);
    const atual = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    const atualBruta = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
    if (!ehSolicitacao_(atual, mapa)) throw new Error("A linha selecionada não é uma solicitação.");
    const antes = {
      status: statusNormalizado_(valor_(atual, mapa, "STATUS")),
      observacoes: valor_(atual, mapa, "NOTES")
    };
    validarGestao_(prioridade, prazo);
    exigirVersaoSolicitacao_(versaoEsperada, atualBruta, linha, obterMetadadosGestao_(), atual);
    const nomeJuiz = String(valor_(atual, mapa, "ASSIGNED_JUDGE") || "").trim();
    if (novoStatus === "Em atendimento" && !nomeJuiz) throw new Error("Designe um juiz antes de iniciar o atendimento.");
    const reabrindo = statusFinal_(antes.status) && !statusFinal_(novoStatus);
    let excede = false;
    if (reabrindo && nomeJuiz) {
      excede = validarCapacidadeDesignacao_(listarDados_(usuario), linha, nomeJuiz,
        quantidadeInteira_(valor_(atual, mapa, "CAPACITY")), justificativaExcesso, permitirExcesso).excede;
    }

    escreverCampo_(aba, mapa, linha, "STATUS", novoStatus);
    escreverCampo_(aba, mapa, linha, "NOTES", textoCelulaSeguro_(notas));
    const alteracaoGestao = salvarMetadadosGestao_(usuario, linha, prioridade, prazo);
    registrarAuditoria_(usuario, "ATUALIZAR_SOLICITACAO", linha,
      Object.assign({}, antes, alteracaoGestao.antes),
      Object.assign({ status: novoStatus, observacoes: notas, justificativaExcesso: excede ? String(justificativaExcesso).trim() : "" }, alteracaoGestao.depois));
    SpreadsheetApp.flush();
    const solicitacao = solicitacaoDaLinha_(atual, atualBruta, mapa, linha, obterMetadadosGestao_(), true);
    const notificacao = antes.status !== novoStatus ? notificarAtualizacao_(solicitacao, novoStatus, usuario) : { enviada: false, motivo: "Status não alterado" };
    return { ok: true, notificacao: notificacao };
  } finally {
    lock.releaseLock();
  }
}
