function normalizarNome_(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function numeroQuantidade_(valor) {
  const quantidade = quantidadeInteira_(valor);
  return quantidade === null ? 0 : quantidade;
}

// Aceita inteiro, agrupamento brasileiro e o sufixo legado "minutas".
// Intervalos, negativos, frações e texto livre exigem revisão da origem.
function quantidadeInteira_(valor) {
  if (typeof valor === "number") return Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
  const texto = String(valor == null ? "" : valor).trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:\s+minutas?)?$/i.test(texto)) return null;
  const numero = Number(texto.replace(/\s+minutas?$/i, "").replace(/\./g, ""));
  return Number.isSafeInteger(numero) ? numero : null;
}

function quantidadeSolicitacao_(valor) {
  const quantidade = quantidadeInteira_(valor);
  return quantidade !== null && quantidade > 0 ? quantidade : null;
}

// Comparação dentro do bloqueio de escrita, sem migração das abas existentes.
function versaoSolicitacao_(linha, numeroLinha, metadados, linhaExibida) {
  const metadadosSeguros = metadados || {};
  const gestao = metadadosSeguros[numeroLinha] || {};
  return hashToken_(JSON.stringify({ linha: linha, exibicao: linhaExibida, origem: numeroLinha,
    prioridade: gestao.prioridade || "Normal", prazo: gestao.prazo || "",
    atualizadoEm: gestao.atualizadoEm || "", atualizadoPor: gestao.atualizadoPor || "" }));
}

function exigirVersaoSolicitacao_(versaoEsperada, linha, numeroLinha, metadados, linhaExibida) {
  if (!versaoEsperada || versaoEsperada !== versaoSolicitacao_(linha, numeroLinha, metadados, linhaExibida)) {
    throw new Error("Esta solicitação foi alterada ou a tela está desatualizada. Feche a edição, atualize os dados e confira as mudanças antes de salvar novamente.");
  }
}

function textoCadastroJuiz_(valor, rotulo, limite, obrigatorio) {
  const texto = String(valor == null ? "" : valor).trim();
  if (obrigatorio && !texto) throw new Error("Informe " + rotulo + ".");
  if (texto.length > limite) throw new Error(rotulo + " deve ter no máximo " + limite + " caracteres.");
  return texto;
}

function salvarJuiz_(usuario, dados) {
  const numeroLinha = Number(dados && dados.id);
  const nome = textoCadastroJuiz_(dados && dados.nome, "o nome do juiz", 150, true);
  const email = normalizarEmail_(dados && dados.email);
  const telefone = textoCadastroJuiz_(dados && dados.telefone, "o telefone", 80, false);
  const materias = textoCadastroJuiz_(dados && dados.materias, "as matérias", 1000, false);
  const observacoes = textoCadastroJuiz_(dados && dados.observacoes, "as observações", 4000, false);
  const status = String(dados && dados.status || "").trim();
  const justificativa = textoCadastroJuiz_(dados && dados.justificativa, "a justificativa", 500, false);
  const capacidade = quantidadeInteira_(dados && dados.capacidade);
  if (!Number.isInteger(numeroLinha)) throw new Error("Cadastro de juiz inválido.");
  if (capacidade === null) throw new Error("A quantidade limite deve ser um inteiro não negativo.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido ou deixe o campo vazio.");
  if (!JL_CONFIG.STATUS.includes(status)) throw new Error("Status do juiz inválido.");

  const aba = obterFonte_();
  const linha = validarLinha_(aba, numeroLinha);
  const mapa = mapaCabecalhos_(aba);
  const atual = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const atualBruta = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
  if (!ehJuizLeigo_(atual, mapa)) throw new Error("A linha selecionada não é um cadastro de juiz leigo.");
  exigirVersaoJuiz_(dados && dados.versao, atualBruta, linha, atual);
  const antesCadastro = cadastroJuizDaLinha_(atual, atualBruta, mapa, linha);
  const nomeMudou = normalizarNome_(nome) !== normalizarNome_(antesCadastro.nome);
  const ativasDoJuiz = listarDados_(usuario).todasSolicitacoes.filter(item => !statusFinal_(item.status) && normalizarNome_(item.juiz) === normalizarNome_(antesCadastro.nome));
  if (nomeMudou && ativasDoJuiz.length) {
    throw new Error("Não altere o nome enquanto houver " + ativasDoJuiz.length + " solicitação(ões) ativa(s) designada(s) a este juiz. Redesignar ou concluir as solicitações antes.");
  }
  if (statusFinal_(status) && !statusFinal_(antesCadastro.status) && ativasDoJuiz.length) {
    throw new Error("Não encerre este cadastro enquanto houver " + ativasDoJuiz.length + " solicitação(ões) ativa(s) designada(s). Redesignar ou concluir as solicitações antes.");
  }
  if (statusFinal_(status) && status !== antesCadastro.status && justificativa.length < 5) {
    throw new Error("Informe uma justificativa com pelo menos 5 caracteres ao encerrar o cadastro do juiz.");
  }

  const antes = {
    nome: antesCadastro.nome, email: antesCadastro.email, telefone: antesCadastro.telefone,
    capacidade: antesCadastro.capacidade, materias: antesCadastro.materias,
    observacoes: antesCadastro.observacoes, status: antesCadastro.status
  };
  escreverCampo_(aba, mapa, linha, "NAME", textoCelulaSeguro_(nome));
  escreverCampo_(aba, mapa, linha, "EMAIL", textoCelulaSeguro_(email));
  escreverCampo_(aba, mapa, linha, "PHONE", textoCelulaSeguro_(telefone));
  escreverCampo_(aba, mapa, linha, "CAPACITY", capacidade);
  escreverCampo_(aba, mapa, linha, "SUBJECTS", textoCelulaSeguro_(materias));
  escreverCampo_(aba, mapa, linha, "PRODUCTIVITY", textoCelulaSeguro_(observacoes));
  escreverCampo_(aba, mapa, linha, "STATUS", status);
  const depois = { nome: nome, email: email, telefone: telefone, capacidade: capacidade,
    materias: materias, observacoes: observacoes, status: status, justificativa: justificativa };
  registrarAuditoria_(usuario, "ATUALIZAR_JUIZ", linha, antes, depois);
  SpreadsheetApp.flush();
  const atualizado = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const atualizadoBruto = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
  return { ok: true, juiz: cadastroJuizDaLinha_(atualizado, atualizadoBruto, mapa, linha) };
}

function validarCapacidadeDesignacao_(dados, linha, nome, quantidade, justificativa, permitirExcesso) {
  const chave = normalizarNome_(nome);
  const candidatos = dados.juizes.filter(item => normalizarNome_(item.nome) === chave);
  if (candidatos.length > 1) throw new Error("Há cadastros ativos com o mesmo nome. Confira a origem antes de designar.");
  const juiz = candidatos[0];
  if (!juiz) throw new Error("O juiz designado não possui cadastro ativo. Use a designação para escolher outro juiz.");
  if (quantidade === null || quantidade <= 0) throw new Error("Peça ao solicitante que informe uma quantidade inteira positiva de minutas no formulário antes de designar ou reabrir.");
  if (!juiz.capacidadeValida || !juiz.statusValido) throw new Error("A capacidade ou o status do juiz precisa de revisão na origem antes da designação.");
  const outras = dados.todasSolicitacoes.filter(item => item.id !== linha && !statusFinal_(item.status) && normalizarNome_(item.juiz) === chave);
  const invalidas = outras.filter(item => item.quantidadeInformada && !item.quantidadeValida);
  if (invalidas.length) throw new Error("Há solicitações ativas deste juiz com quantidade inválida. Corrija a origem antes de calcular a carga.");
  // Campos vazios em solicitações antigas não contam como carga conhecida.
  // A quantidade da nova solicitação continua obrigatória e positiva.
  const projetada = outras.reduce((total, item) => total + (item.quantidadeValida ? item.quantidadeNumerica : 0), 0) + quantidade;
  const excede = projetada > juiz.capacidadeNumerica;
  const motivo = String(justificativa || "").trim();
  if (motivo.length > 500) throw new Error("A justificativa deve ter no máximo 500 caracteres.");
  if (excede && permitirExcesso !== true) throw new Error("A operação excede a capacidade declarada do juiz. Confirme a exceção e informe uma justificativa.");
  if (excede && motivo.length < 5) throw new Error("Informe uma justificativa para exceder a capacidade.");
  return { juiz: juiz, excede: excede };
}

function dataIso_(valor) {
  if (!valor) return "";
  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return "";
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function diasDesde_(valor) {
  if (!valor) return 0;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return 0;
  return Math.max(0, Math.floor((new Date().getTime() - data.getTime()) / 86400000));
}

function obterMetadadosGestao_() {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.MANAGEMENT_SHEET);
  const mapa = {};
  if (!aba) return mapa;
  if (aba.getLastRow() < 2) return mapa;
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 5).getValues();
  linhas.forEach((linha, indice) => {
    const origem = Number(linha[0]);
    if (!Number.isInteger(origem) || origem < 2) return;
    mapa[origem] = {
      linhaGestao: indice + 2,
      prioridade: JL_CONFIG.PRIORITIES.includes(String(linha[1])) ? String(linha[1]) : "Normal",
      prazo: dataIso_(linha[2]),
      atualizadoEm: linha[3] instanceof Date ? linha[3].toISOString() : String(linha[3] || ""),
      atualizadoPor: normalizarEmail_(linha[4])
    };
  });
  return mapa;
}

function validarGestao_(prioridade, prazo) {
  if (!JL_CONFIG.PRIORITIES.includes(String(prioridade || "Normal").trim())) throw new Error("Prioridade inválida.");
  const texto = String(prazo || "").trim();
  if (texto) {
    const data = new Date(texto + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) throw new Error("Prazo inválido. Informe uma data existente.");
  }
  if (!abrirPlanilha_().getSheetByName(JL_CONFIG.MANAGEMENT_SHEET)) throw new Error("Execute instalarEstruturasAuxiliares() no editor antes de salvar.");
}

// Argumento legado mantido apenas para rejeitar clientes antigos ou adulterados.
function rejeitarQuantidadeAdministrativa_(valor) {
  if (valor !== undefined) throw new Error("A quantidade é informada pelo solicitante no formulário e não pode ser alterada pela administração. Atualize a página.");
}

function salvarMetadadosGestao_(usuario, numeroLinha, prioridade, prazo, quantidade) {
  rejeitarQuantidadeAdministrativa_(quantidade);
  validarGestao_(prioridade, prazo);
  const novaPrioridade = String(prioridade || "Normal").trim();
  if (!JL_CONFIG.PRIORITIES.includes(novaPrioridade)) throw new Error("Prioridade inválida.");
  const novoPrazo = String(prazo || "").trim();
  if (novoPrazo && !/^\d{4}-\d{2}-\d{2}$/.test(novoPrazo)) throw new Error("Prazo inválido.");
  const planilha = abrirPlanilha_();
  const aba = planilha.getSheetByName(JL_CONFIG.MANAGEMENT_SHEET);
  if (!aba) throw new Error("Execute instalarEstruturasAuxiliares_ para criar a gestão de prazos.");
  const existentes = obterMetadadosGestao_();
  const anterior = existentes[numeroLinha] || { prioridade: "Normal", prazo: "" };
  const valores = [numeroLinha, novaPrioridade, novoPrazo ? new Date(novoPrazo + "T12:00:00") : "", new Date(), usuario.email];
  if (anterior.linhaGestao) aba.getRange(anterior.linhaGestao, 1, 1, valores.length).setValues([valores]);
  else aba.appendRow(valores);
  return { antes: { prioridade: anterior.prioridade, prazo: anterior.prazo },
    depois: { prioridade: novaPrioridade, prazo: novoPrazo } };
}

function listarHistorico_(numeroLinha) {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!aba || aba.getLastRow() < 2) return [];
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 7).getValues();
  return linhas.filter(linha => Number(linha[4]) === Number(numeroLinha)).map(linha => {
    let antes = {}, depois = {};
    try { antes = JSON.parse(String(linha[5] || "{}")); } catch (erro) {}
    try { depois = JSON.parse(String(linha[6] || "{}")); } catch (erro) {}
    return {
      data: linha[0] instanceof Date ? linha[0].toISOString() : String(linha[0] || ""),
      email: normalizarEmail_(linha[1]),
      perfil: String(linha[2] || ""),
      acao: String(linha[3] || ""),
      antes: antes,
      depois: depois
    };
  }).reverse();
}

function notificacoesAtivas_() {
  const valor = String(PropertiesService.getScriptProperties().getProperty(JL_CONFIG.PROPERTIES.SEND_NOTIFICATIONS) || "FALSE").toUpperCase();
  return ["TRUE", "VERDADEIRO", "SIM", "1"].includes(valor);
}

function enviarNotificacao_(destinatario, assunto, corpo) {
  const email = normalizarEmail_(destinatario);
  if (!notificacoesAtivas_()) return { enviada: false, motivo: "Notificações desativadas" };
  if (!email || !email.endsWith("@" + dominioInstitucional_())) return { enviada: false, motivo: "Destinatário institucional ausente" };
  try {
    MailApp.sendEmail({ to: email, subject: assunto, body: corpo, name: JL_CONFIG.APP_NAME });
    return { enviada: true, destinatario: email };
  } catch (erro) {
    return { enviada: false, motivo: "Falha ao enviar e-mail: " + erro.message };
  }
}

function notificarDesignacao_(solicitacao, juiz, administrador) {
  const assunto = "Nova designação — Solicitação #" + solicitacao.id;
  const corpo = [
    "Olá, " + (juiz.nome || ""),
    "",
    "Você foi designado(a) para uma solicitação no sistema de Gestão de Juízes Leigos — PJES.",
    "Solicitação: #" + solicitacao.id,
    "Unidade: " + (solicitacao.unidade || "Não informada"),
    "Quantidade: " + (solicitacao.quantidade || "Não informada"),
    "Competências: " + (solicitacao.competencias || "Não informadas"),
    "",
    "Designação realizada por: " + administrador.email
  ].join("\n");
  return enviarNotificacao_(juiz.email, assunto, corpo);
}

function notificarAtualizacao_(solicitacao, novoStatus, administrador) {
  const assunto = "Atualização da solicitação #" + solicitacao.id;
  const corpo = [
    "Olá, " + (solicitacao.solicitante || ""),
    "",
    "Sua solicitação foi atualizada no sistema de Gestão de Juízes Leigos — PJES.",
    "Solicitação: #" + solicitacao.id,
    "Unidade: " + (solicitacao.unidade || "Não informada"),
    "Novo status: " + novoStatus,
    "",
    "Atualização realizada por: " + administrador.email
  ].join("\n");
  return enviarNotificacao_(solicitacao.email, assunto, corpo);
}
