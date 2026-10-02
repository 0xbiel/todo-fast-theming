import test from 'node:test';import assert from 'node:assert/strict';
import {createStyleService,createCerebrasAdapter} from '../server/style-service.js';
import {safeDiagnosticText} from '../src/ui-errors.js';
import {themes} from '../src/theme.js';
const run=result=>createStyleService({verifyIdToken:async()=>({uid:'u',email:'test@example.com',email_verified:true}),ownerKey:'fixture-key',approvedEmails:['test@example.com'],ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async()=>{}},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:async()=>result})({token:'fixture',prompt:'calm ocean'});
test('safe diagnostics distinguish all pre-validation result failures',async()=>{
 for(const [result,stage] of [[{content:'{}',finishReason:'content_filter',failure:'output'},'finish_reason'],[{content:null,finishReason:'stop'},'content_type'],[{content:'x'.repeat(262145),finishReason:'stop'},'content_size'],[{content:JSON.stringify(themes[0]),finishReason:'stop',usage:{prompt_tokens:4097,completion_tokens:100}},'usage_bounds'],[{content:'not-json',finishReason:'stop'},'theme_validation']]){const r=await run(result);assert.equal(r.status,502);assert.equal(r.diagnostic.stage,stage);assert.match(safeDiagnosticText(r.diagnostic),new RegExp('stage='+stage));}
});
test('diagnostic UI never echoes arbitrary fields, labels, strings or invalid numeric data',()=>{
 assert.equal(safeDiagnosticText({stage:'secret',validation:'secret',finishReason:'secret',contentKind:'secret',contentLength:'secret',promptTokens:-1,completionTokens:Infinity,extra:'secret'}),'');
 assert.match(safeDiagnosticText({stage:'usage_bounds',promptTokens:4097,inputCap:4096}),/promptTokens=4097/);
});
test('malformed provider envelope is explicitly labeled without response text',async()=>{
 const adapter=createCerebrasAdapter(async()=>new Response('private invalid body'));
 await assert.rejects(adapter({key:'fixture',prompt:'calm ocean',maxCompletionTokens:32768}),e=>e.diagnosticStage==='envelope_json'&&!e.message.includes('private'));
});
