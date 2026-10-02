import test from 'node:test';import assert from 'node:assert/strict';import {requestStyle} from '../src/style-client.js';import {validateStyleRequest,themes} from '../src/theme.js';import {styleErrorMessage,UiError} from '../src/ui-errors.js';import {createStyleService,createCerebrasAdapter} from '../server/style-service.js';
test('reported user prompts are visual requests',()=>{for(const prompt of ['calm ocean','realistic calm ocean','leather background with post its as the cards'])assert.equal(validateStyleRequest(prompt),prompt)});
test('client classifies auth/setup/quota/provider errors and never renders response freeform',async()=>{
 for(const [status,code] of [[401,'auth'],[503,'setup'],[429,'quota'],[502,'provider_auth'],[502,'provider_config'],[502,'output_limit'],[502,'output']]){
  await assert.rejects(requestStyle({prompt:'calm ocean',getIdToken:async()=>'mock-token',fetchImpl:async()=>new Response(JSON.stringify({code,error:'private raw freeform should not display'}),{status})}),error=>error.code===code&&!error.message.includes('private'));
 }
 assert.equal(styleErrorMessage(Error('secret raw response')).includes('secret'),false);
});
test('401 refresh is bounded and never automatically retries a potentially paid style call',async()=>{
 let requests=0,refreshes=0;await assert.rejects(requestStyle({prompt:'calm ocean',getIdToken:async()=>'mock-token',refreshAuth:async()=>refreshes++,fetchImpl:async()=>{requests++;return new Response('{}',{status:401})}}),error=>error.code==='auth_refreshed');assert.equal(requests,1);assert.equal(refreshes,1);
});
test('truncated response retains exact consumed charge and exposes safe diagnostic',async()=>{
 let charged,usedCap;
 const generate=createCerebrasAdapter(async(_url,options)=>{usedCap=JSON.parse(options.body).max_completion_tokens;return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"unfinished":',reasoning:'raw private reasoning'}}],usage:{prompt_tokens:300,completion_tokens:2048}}))});
 const ledger={reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async(_id,cost)=>{if(cost!==undefined)charged=cost},cancel:async()=>assert.fail()};
 const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'approved@example.com',email_verified:true}),generate,ownerKey:'mock-key',approvedEmails:['approved@example.com'],ledger,maxCompletionTokens:2048,rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000}});
 const result=await service({token:'verified',prompt:'calm ocean'});assert.equal(result.status,502);assert.equal(result.code,'output_limit');assert.equal(result.diagnostic.finishReason,'length');assert.equal(result.diagnostic.completionTokens,2048);assert.equal(charged,3349);assert.equal(usedCap,2048);assert.equal(JSON.stringify(result).includes('reasoning'),false);
});
test('completed malformed design still charges consumed usage and returns output error',async()=>{
 let charged;const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'x@y.z',email_verified:true}),generate:async()=>({content:JSON.stringify({...themes[0],art:{...themes[0].art,shapes:Array(9).fill({})}}),finishReason:'stop',usage:{prompt_tokens:100,completion_tokens:200}}),ownerKey:'mock-key',approvedEmails:['x@y.z'],ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async(_id,cost)=>{if(cost!==undefined)charged=cost},cancel:async()=>assert.fail()},rates:{inputMicrosPerMillion:1000000,outputMicrosPerMillion:1000000}});
 const result=await service({token:'verified',prompt:'leather background'});assert.equal(result.code,'output');assert.equal(charged,300);
});

test('complete valid-schema designs with poor model-chosen contrast are safely repaired rather than wasted',async()=>{
 const raw={...themes[0],surface:'#ffff88',text:'#ffffff',urgentColor:'#eeee88',art:{...themes[0].art,start:'#ffffff',end:'#eeeecc'}};
 const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'x@y.z',email_verified:true}),generate:async()=>({content:JSON.stringify(raw),finishReason:'stop',usage:{prompt_tokens:100,completion_tokens:200}}),ownerKey:'mock-key',approvedEmails:['x@y.z'],ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async()=>{},cancel:async()=>{}},rates:{inputMicrosPerMillion:1000000,outputMicrosPerMillion:1000000}});
 const result=await service({token:'verified',prompt:'leather background with post its as the cards'});assert.equal(result.status,200);assert.equal(result.theme.text,'#000000');assert.equal(result.theme.urgentColor,'#000000');
});
test('latest defaults request provider maximum with no reasoning and reserve matching worst-case cost',async()=>{
 let cap,effort,reserved;
 const adapter=createCerebrasAdapter(async(_url,options)=>{const payload=JSON.parse(options.body);cap=payload.max_completion_tokens;effort=payload.reasoning_effort;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(themes[0]),reasoning:'x'.repeat(40000)}}],usage:{prompt_tokens:100,completion_tokens:10000}}))});
 const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'x@y.z',email_verified:true}),generate:adapter,ownerKey:'mock-key',approvedEmails:['x@y.z'],ledger:{reserve:async value=>{reserved=value.amount;return{id:'r'}},dispatch:async()=>{},settle:async()=>{},cancel:async()=>{}},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000}});
 const result=await service({token:'verified',prompt:'calm ocean'});assert.equal(result.status,200);assert.equal(cap,32768);assert.equal(effort,'none');assert.equal(reserved,52880);
});
