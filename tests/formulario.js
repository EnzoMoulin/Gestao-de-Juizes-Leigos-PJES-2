const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const title='Quantas minutas estão sendo solicitadas?';
let email='admin@tjes.jus.br',rows,answers,audits,items;
const props={SPREADSHEET_ID:'fixture',ADMIN_EMAILS:email};
const item={getTitle:()=>title,getId:()=>7,getType:()=> 'TEXT'};
const sheet={getFormUrl:()=> 'https://example.invalid/form',getDataRange:()=>({getValues:()=>rows}),getRange:(r,c)=>({getValue:()=>rows[r-1][c-1],setValue:v=>{rows[r-1][c-1]=v;}})};
const book={getId:()=> 'fixture',getSheetByName:name=>name==='AUDITORIA'?{appendRow:r=>audits.push(r)}:sheet};
const form={getDestinationId:()=> 'fixture',getItems:()=>items,getResponses:()=>answers.map(([id,value])=>({getId:()=>id,getResponseForItem:()=>({getResponse:()=>value})}))};
const c=vm.createContext({console:{log(){}},Session:{getEffectiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})},SpreadsheetApp:{openById:()=>book,flush(){}},FormApp:{openByUrl:()=>form},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
vm.runInContext(fs.readFileSync('maintenance/PrepararPlanilha.gs','utf8'),c);
vm.runInContext(fs.readFileSync('maintenance/ConferirFormulario.gs','utf8'),c);
function reset(){email=props.ADMIN_EMAILS;rows=[['FORM_RESPONSE_ID',title,'Cargo ou Função:'],['a','','Assessor'],['b','','Magistrado'],['c','','Juiz Leigo'],['d',6,'Assessor'],['e','','Assessor']];answers=[['a','3'],['b','5'],['c','20'],['d','8'],['e',''],['missing','10']];audits=[];items=[item];}
reset();assert.equal(c.conferirQuantidadesFormulario().recuperaveis,2);assert.equal(audits.length,0);assert.equal(rows[1][1],'');
c.recuperarQuantidadesFormulario();assert.equal(rows[1][1],3);assert.equal(rows[2][1],5);assert.equal(rows[3][1],'');assert.equal(rows[4][1],6);assert.equal(rows[5][1],'');assert.equal(audits.length,2);assert.equal(JSON.parse(audits[0][6]).formResponseId,'a');assert.equal(c.recuperarQuantidadesFormulario().recuperaveis,0);assert.equal(audits.length,2);
for(const variant of ['auth','duplicateId','missingTitle','duplicateQuestion']){reset();if(variant==='auth')email='viewer@tjes.jus.br';if(variant==='duplicateId')rows[2][0]='a';if(variant==='missingTitle')rows[0][1]='Outro campo';if(variant==='duplicateQuestion')items.push(item);assert.throws(()=>c.recuperarQuantidadesFormulario());assert.equal(audits.length,0);assert.equal(rows[1][1],'');}
console.log('Forms: conferência sem escrita, recuperação por ID, auditoria, repetição, autorização e ambiguidades aprovadas.');
