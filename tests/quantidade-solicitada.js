// Regressão do relato real (set/2026): a aba de respostas possui apenas a coluna
// de capacidade do juiz ("Número de minutas em que necessita trabalhar no mês
// atual:") e NÃO possui "Quantas minutas estão sendo solicitadas?". O site deve
// exibir "Quantidade não informada", bloquear designação e permitir cancelamento.
// Quando o Forms cria a pergunta (coluna anexada ao fim, após FORM_RESPONSE_ID),
// os valores devem alimentar "Minutas solicitadas" sem tocar na capacidade.
// Sheets, cache e e-mail simulados; nenhuma chamada externa.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');
let writes = 0, locked = false;
const props = {SPREADSHEET_ID:'fixture',ADMIN_EMAILS:'admin@tjes.jus.br',ALLOWED_EMAILS:'viewer@tjes.jus.br'};
let active = 'admin@tjes.jus.br';
const ctx = vm.createContext({console,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})},
  Session:{getActiveUser:()=>({getEmail:()=>active}),getScriptTimeZone:()=> 'America/Sao_Paulo'},
  Utilities:{formatDate:d=>d.toISOString().slice(0,10),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
  CacheService:{getScriptCache:()=>({get:()=>JSON.stringify({email:active}),remove(){}})},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})}
});
for(const file of ['Config','Management','Data','Auth','Users','API']) vm.runInContext(fs.readFileSync('src/'+file+'.gs','utf8'),ctx);
const run = code=>vm.runInContext(code,ctx);
// Cabeçalhos reais da cópia Teste.xlsx (18 colunas, sem a pergunta de quantidade).
const baseTitles = [...Object.values(run('JL_CONFIG.HEADERS')), 'FORM_RESPONSE_ID'];
const quantityTitle = run('JL_CONFIG.REQUEST_QUANTITY_HEADER');
const headerByKey = {...run('JL_CONFIG.HEADERS'), REQUEST_QUANTITY: quantityTitle};
function row(titles, values){const result=titles.map(()=>'');for(const [key,value] of Object.entries(values)){const idx=titles.indexOf(headerByKey[key]);if(idx>=0)result[idx]=value;}return result;}
const MAGISTRADO = {FUNCTION:'Magistrado',NAME:'RAMON SILVA ALMEIDA CUNHA',EMAIL:'ramon@tjes.jus.br',UNIT:'Cariacica - Comarca da Capital',STATUS:'Pendente'};
const ASSESSOR = {FUNCTION:'Assessor',NAME:'SHINAYDER CRISTIAN',EMAIL:'outro@tjes.jus.br',UNIT:'Vila Velha - Comarca da Capital',STATUS:'Pendente'};
const JUIZ = {FUNCTION:'Juíza Leiga',NAME:'Juíza Teste',EMAIL:'juiza@tjes.jus.br',CAPACITY:'20',STATUS:'Pendente'};
class Sheet {
  constructor(name,rows){this.name=name;this.rows=rows;}
  getName(){return this.name;} getSheetId(){return 0;} getLastRow(){return this.rows.length;} getLastColumn(){return this.rows[0].length;}
  getRange(r,c,n=1,m=1){const sheet=this;return {
    getValues:()=>sheet.rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m)),
    getDisplayValues:()=>sheet.rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m).map(v=>String(v??''))),
    setValue(value){return this.setValues([[value]]);},
    setValues(values){assert(locked,'all writes must happen under lock');writes++;values.forEach((row,i)=>{sheet.rows[r-1+i]??=[];row.forEach((value,j)=>sheet.rows[r-1+i][c-1+j]=value);});return this;}
  };}
  appendRow(row){assert(locked);writes++;this.rows.push(row);}
}
let sheets, titles;
function reset(withQuantity){
  writes=0;locked=false;active='admin@tjes.jus.br';
  titles = withQuantity ? [...baseTitles, quantityTitle] : baseTitles.slice();
  const r = values=>row(titles, values);
  const rows=[titles.slice(),
    r({...MAGISTRADO, ...(withQuantity ? {REQUEST_QUANTITY:'3'} : {})}),
    r({...ASSESSOR, ...(withQuantity ? {REQUEST_QUANTITY:'5'} : {})}),
    r(JUIZ)];
  sheets={
    'Respostas ao formulário 1':new Sheet('Respostas ao formulário 1',rows),
    GESTAO_SOLICITACOES:new Sheet('GESTAO_SOLICITACOES',[Array.from(run('JL_CONFIG.MANAGEMENT_HEADERS'))]),
    AUDITORIA:new Sheet('AUDITORIA',[['DATA_HORA','EMAIL','PERFIL','ACAO','LINHA_ORIGEM','ANTES','DEPOIS']])};
}
ctx.SpreadsheetApp={openById:()=>({getSheetByName:n=>sheets[n]||null,getName:()=> 'Fixture',getId:()=> 'fixture',getUrl:()=> 'https://example.invalid/fixture'}),flush(){}};
const data=()=>run('apiBootstrap("token")');
const byId=id=>data().solicitacoes.find(r=>r.id===id);
function assign(id,version,reason='',confirm=false,quantity){ctx.args=[version,reason,confirm,quantity];return run(`apiDesignarJuiz("token",${id},"Juíza Teste",args[1],args[2],"Normal","",args[0],args[3])`);}
function update(id,version,status){ctx.args=[version,status];return run(`apiAtualizarSolicitacao("token",${id},args[1],"", "Normal","",args[0],"",false)`);}
let passed=0;
function test(name,fn){fn();assert.equal(locked,false,'lock released');passed++;console.log('OK '+name);}

// Fase 1 — estado real relatado: sem a coluna, tudo "não informado", sem designação.
reset(false);
test('sem a coluna, fonte sinaliza configuração pendente',()=>{
  assert.equal(data().fonte.quantidadeFormularioConfigurada,false);
  assert.equal(byId(2).quantidadeInformada,false);
  assert.equal(byId(3).quantidadeInformada,false);
});
test('sem quantidade, designação é bloqueada sem escrita',()=>{
  assert.throws(()=>assign(2,byId(2).versao,'Motivo válido',true),/solicitante/);
  assert.throws(()=>assign(3,byId(3).versao,'Motivo válido',true),/solicitante/);
  assert.equal(writes,0);
});
test('sem quantidade, cancelamento continua permitido',()=>{
  update(2,byId(2).versao,'Cancelado');
  assert.equal(byId(2).status,'Cancelado');
});

// Fase 2 — Forms cria a pergunta (coluna ao fim): valores alimentam Minutas solicitadas.
reset(true);
test('coluna ao fim alimenta Minutas solicitadas por título',()=>{
  assert.equal(data().fonte.quantidadeFormularioConfigurada,true);
  assert.equal(byId(2).quantidade,'3');
  assert.equal(byId(2).quantidadeNumerica,3);
  assert.equal(byId(3).quantidadeNumerica,5);
  assert.equal(byId(2).quantidadeValida,true);
});
test('designação usa a quantidade da origem e soma a carga do juiz',()=>{
  assign(2,byId(2).versao);assign(3,byId(3).versao);
  assert.equal(data().juizes[0].designadas,8);
  assert.equal(data().juizes[0].disponiveis,12);
});
test('capacidade do juiz permanece intacta e separada',()=>{
  assign(2,byId(2).versao);
  const juiz = data().juizes.find(j=>j.nome==='Juíza Teste');
  assert.equal(juiz.capacidade,'20');
  assert.equal(juiz.capacidadeNumerica,20);
});
console.log(passed+' cenários de quantidade solicitada aprovados.');
