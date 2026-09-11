// Regressões de integridade com Sheets, cache e e-mail simulados; nenhuma chamada externa.
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
const headers=run('JL_CONFIG.HEADERS'), titles=Object.values(headers);
const column=key=>titles.indexOf(headers[key]);
function row(values){const result=titles.map(()=> '');for(const [key,value] of Object.entries(values))result[column(key)]=value;return result;}
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
let sheets;
function reset(){writes=0;locked=false;active='admin@tjes.jus.br';sheets={
 'Respostas ao formulário 1':new Sheet('Respostas ao formulário 1',[titles,
 row({FUNCTION:'Assessor',NAME:'Pedido encerrado',EMAIL:'viewer@tjes.jus.br',CAPACITY:'20',STATUS:'Concluído',ASSIGNED_JUDGE:'Juíza Teste',NOTES:'Encerrado para teste'}),
 row({FUNCTION:'Juíza Leiga',NAME:'Juíza Teste',CAPACITY:'100',STATUS:'Pendente'}),
 row({FUNCTION:'Assessor',NAME:'Pedido ativo',EMAIL:'outro@tjes.jus.br',CAPACITY:'90',STATUS:'Em atendimento',ASSIGNED_JUDGE:'Juíza Teste'})]),
 GESTAO_SOLICITACOES:new Sheet('GESTAO_SOLICITACOES',[Array.from(run('JL_CONFIG.MANAGEMENT_HEADERS')),
   [2,'Normal','', '', '', 20],
   [4,'Normal','', '', '', 90]]),
 AUDITORIA:new Sheet('AUDITORIA',[['DATA_HORA','EMAIL','PERFIL','ACAO','LINHA_ORIGEM','ANTES','DEPOIS']])};}
ctx.SpreadsheetApp={openById:()=>({getSheetByName:n=>sheets[n]||null,getName:()=> 'Fixture',getId:()=> 'fixture',getUrl:()=> 'https://example.invalid/fixture'}),flush(){}};
const data=()=>run('apiBootstrap("token")');
const current=()=>data().solicitacoes.find(r=>r.id===2);
function update(version,status='Em atendimento',reason='',confirm=false,quantity){ctx.args=[version,status,reason,confirm,quantity];return run('apiAtualizarSolicitacao("token",2,args[1],"Andamento atualizado","Alta","",args[0],args[2],args[3],args[4])');}
function assign(version,reason='',confirm=false,quantity){ctx.args=[version,reason,confirm,quantity];return run('apiDesignarJuiz("token",2,"Juíza Teste",args[1],args[2],"Normal","",args[0],args[3])');}
let passed=0;
function test(name,fn){reset();fn();assert.equal(locked,false,'lock released');passed++;console.log('OK '+name);}
test('inteiros e formatos legados sem ambiguidade',()=>{
 for(const [input,expected] of [[20,20],['20 minutas',20],['1.000',1000],['1.000 minutas',1000],['0',0],[' 25 ',25]]){ctx.input=input;assert.equal(run('quantidadeInteira_(input)'),expected);}
 for(const input of ['',null,'-20','20 a 30','10,5','1.5','20 minutas e 30','cerca de 20',1.5,'9007199254740992']){ctx.input=input;assert.equal(run('quantidadeInteira_(input)'),null,String(input));}
});
test('reabertura acima da capacidade bloqueada antes de qualquer escrita',()=>{assert.throws(()=>update(current().versao),/excede/);assert.equal(writes,0);});
test('exceção exige booleano real e motivo',()=>{const v=current().versao;assert.throws(()=>update(v,'Em atendimento','Motivo válido','false'),/excede/);assert.throws(()=>update(v,'Em atendimento','abc',true),/justificativa/);assert.equal(writes,0);});
test('reabertura autorizada registra justificativa e nova carga',()=>{update(current().versao,'Em atendimento','Redistribuição excepcional aprovada',true);assert.equal(current().status,'Em atendimento');assert.equal(data().juizes[0].designadas,110);const audit=sheets.AUDITORIA.rows.at(-1);assert.equal(JSON.parse(audit[6]).justificativaExcesso,'Redistribuição excepcional aprovada');});
test('duas edições da mesma versão não sobrescrevem a primeira',()=>{const old=current().versao;update(old,'Cancelado');const before=writes;assert.throws(()=>update(old,'Concluído'),/desatualizada/);assert.equal(writes,before);assert.equal(current().status,'Cancelado');});
test('alteração direta na origem invalida a edição aberta',()=>{const old=current().versao;sheets['Respostas ao formulário 1'].rows[1][column('UNIT')]='Unidade alterada';assert.throws(()=>assign(old,'Motivo válido',true),/desatualizada/);assert.equal(writes,0);});
test('alteração de prioridade ou prazo invalida a versão',()=>{const old=current().versao;sheets.GESTAO_SOLICITACOES.rows.push([2,'Urgente','2026-09-20','revisao','admin@tjes.jus.br',20]);assert.throws(()=>update(old,'Cancelado'),/desatualizada/);assert.equal(writes,0);});
test('clientes antigos sem versão não podem gravar',()=>{assert.throws(()=>update(undefined,'Cancelado'),/desatualizada/);assert.throws(()=>assign(undefined),/desatualizada/);assert.equal(writes,0);});
test('quantidade ambígua bloqueia designação',()=>{sheets.GESTAO_SOLICITACOES.rows[1][5]='20 a 30';assert.throws(()=>assign(current().versao,'Motivo válido',true),/inteiro positivo/);assert.equal(writes,0);});
test('carga desconhecida não cria disponibilidade fictícia',()=>{sheets.GESTAO_SOLICITACOES.rows[2][5]='indefinida';assert.equal(data().metricas.disponiveis,0);assert.equal(data().juizes[0].disponiveis,null);assert.throws(()=>assign(current().versao),/quantidade inválida/);assert.equal(writes,0);});
test('quantidade ausente em solicitação antiga deixa carga parcial sem invalidar capacidade do juiz',()=>{sheets.GESTAO_SOLICITACOES.rows[2][5]='';const juiz=data().juizes[0];assert.equal(juiz.requerRevisao,false);assert.equal(juiz.cargaParcial,true);assert.equal(JSON.stringify(juiz.quantidadesAtribuidasAusentes),'[4]');assert.equal(juiz.designadas,0);assert.equal(juiz.disponiveis,100);assert.equal(data().metricas.disponiveis,1);});
test('quantidade operacional da solicitação não usa a capacidade da resposta',()=>{sheets['Respostas ao formulário 1'].rows[1][column('CAPACITY')]='999';assert.equal(current().quantidadeNumerica,20);const version=current().versao;update(version,'Concluído','Quantidade registrada',false,12);assert.equal(current().quantidadeNumerica,12);assert.equal(sheets['Respostas ao formulário 1'].rows[1][column('CAPACITY')],'999');assert.equal(sheets.GESTAO_SOLICITACOES.rows[1][5],12);});
test('designação grava a quantidade operacional informada',()=>{sheets.GESTAO_SOLICITACOES.rows[1][5]='';const version=current().versao;assign(version,'',false,10);assert.equal(current().quantidadeNumerica,10);assert.equal(current().status,'Em atendimento');assert.equal(sheets.GESTAO_SOLICITACOES.rows[1][5],10);});
test('admin lista e atualiza o cadastro do juiz com auditoria',()=>{const cadastro=run('apiListarCadastrosJuizes("token")[0]');assert.equal(cadastro.id,3);assert.equal(cadastro.capacidadeNumerica,100);ctx.cadastroVersion=cadastro.versao;const resultado=run('apiSalvarJuiz("token",{id:3,versao:cadastroVersion,nome:"Juíza Teste",email:"juiza.teste@example.com",telefone:"27999990000",capacidade:"120",materias:"Cível e Fazenda",observacoes:"Meta revisada",status:"Pendente",justificativa:"Atualização mensal"})');assert.equal(resultado.juiz.capacidadeNumerica,120);assert.equal(sheets['Respostas ao formulário 1'].rows[2][column('CAPACITY')],120);assert.equal(sheets['Respostas ao formulário 1'].rows[2][column('EMAIL')],'juiza.teste@example.com');const auditoria=sheets.AUDITORIA.rows.at(-1);assert.equal(auditoria[3],'ATUALIZAR_JUIZ');assert.equal(Number(auditoria[4]),3);assert.equal(JSON.parse(auditoria[6]).capacidade,120);});
test('edição de juiz exige versão atual e preserva designações ativas',()=>{const cadastro=run('apiListarCadastrosJuizes("token")[0]');ctx.cadastroVersion=cadastro.versao;sheets['Respostas ao formulário 1'].rows[2][column('CAPACITY')]='110';assert.throws(()=>run('apiSalvarJuiz("token",{id:3,versao:cadastroVersion,nome:"Outro nome",email:"juiza.teste@example.com",telefone:"",capacidade:120,materias:"",observacoes:"",status:"Pendente",justificativa:""})'),/desatualizada/);assert.equal(writes,0);reset();const atual=run('apiListarCadastrosJuizes("token")[0]');ctx.cadastroVersion=atual.versao;assert.throws(()=>run('apiSalvarJuiz("token",{id:3,versao:cadastroVersion,nome:"Outro nome",email:"juiza.teste@example.com",telefone:"",capacidade:120,materias:"",observacoes:"",status:"Pendente",justificativa:""})'),/Redesignar ou concluir/);assert.equal(writes,0);});
test('capacidade e status desconhecidos exigem revisão',()=>{for(const [key,value] of [['CAPACITY','a combinar'],['STATUS','desconhecido']]){reset();sheets['Respostas ao formulário 1'].rows[2][column(key)]=value;assert.equal(data().metricas.disponiveis,0);assert.throws(()=>assign(current().versao),/revisão/);assert.equal(writes,0);}});
test('zero é capacidade conhecida sem saldo',()=>{sheets['Respostas ao formulário 1'].rows[2][column('CAPACITY')]='0';const j=data().juizes[0];assert.equal(j.requerRevisao,false);assert.equal(j.disponiveis,0);assert.equal(data().metricas.disponiveis,0);assert.throws(()=>assign(current().versao),/excede/);});
test('nomes duplicados bloqueiam a designação',()=>{sheets['Respostas ao formulário 1'].rows.push(row({FUNCTION:'Juiz Leigo',NAME:'Juiza Teste',CAPACITY:'100'}));assert.equal(data().metricas.disponiveis,0);assert.throws(()=>assign(current().versao),/mesmo nome/);assert.equal(writes,0);});
test('redesignar para o mesmo juiz não duplica carga existente',()=>{const source=sheets['Respostas ao formulário 1'];source.rows[1][column('STATUS')]='Em atendimento';sheets.GESTAO_SOLICITACOES.rows[2][5]=80;assign(current().versao);assert.equal(data().juizes[0].designadas,100);});
test('CONSULTA mantém o escopo e não grava',()=>{active='viewer@tjes.jus.br';assert.equal(data().solicitacoes.length,1);assert.equal(data().fonte,null);assert.throws(()=>update(current().versao),/perfil/);assert.throws(()=>assign(current().versao),/perfil/);assert.equal(writes,0);});
console.log(`${passed} cenários de integridade aprovados.`);
