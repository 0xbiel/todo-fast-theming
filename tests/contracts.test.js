import test from 'node:test';import assert from 'node:assert/strict';import {validateTheme,themes} from '../src/theme.js';import {parseTasks,initialTasks} from '../src/storage.js';
test('rejects executable or network presentation fields',()=>{assert.throws(()=>validateTheme({...themes[0],script:'alert(1)'}));assert.throws(()=>validateTheme({...themes[0],background:'url(https://example.com)'}));assert.throws(()=>validateTheme({...themes[0],radius:200}));});
test('accepts bounded themes',()=>themes.forEach(t=>assert.deepEqual(validateTheme(t),t)));
test('recovers corrupt persisted data',()=>{assert.deepEqual(parseTasks('{broken'),initialTasks);assert.deepEqual(parseTasks('[{"id":"1","title":"x","status":"invalid"}]'),initialTasks);assert.deepEqual(parseTasks('[]'),[])});
import {createSharedKeyGate} from '../server/policy.js';
import {makeSnapshot} from '../src/capabilities.js';
test('shared key requires approval and bounded usage',()=>{const gate=createSharedKeyGate({approvedEmails:['owner@example.com'],perMinute:1});const user={verified:true,emailVerified:true,email:'owner@example.com',uid:'1'};assert.throws(()=>gate({...user,email:'other@example.com'},'paper'));assert.throws(()=>gate({...user,verified:false},'paper'));assert.throws(()=>gate(user,'x'.repeat(501)));assert.equal(gate(user,'paper').capability,'style-only');assert.throws(()=>gate(user,'paper'));});
test('snapshot strips secrets and internal task metadata',()=>{const snapshot=makeSnapshot([{...initialTasks[0],apiKey:'secret',owner:'private'}],themes[0]);assert.equal(JSON.stringify(snapshot).includes('secret'),false);assert.equal(snapshot.tasks[0].owner,undefined)});

import {validateStyleRequest} from '../src/theme.js';
import {createStyleService as serviceFactory,createCerebrasAdapter} from '../server/style-service.js';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDurableLedger} from '../server/ledger.js';
const createStyleService=options=>serviceFactory({...options,ledger:createDurableLedger({path:join(mkdtempSync(join(tmpdir(),'board-contract-')),'quota.sqlite'),limits:{globalBudgetMicros:100000}}),rates:{inputMicrosPerMillion:1000000,outputMicrosPerMillion:1000000}});
test('off-task requests and state changes are rejected',()=>{for(const p of ['What is the weather?','delete tasks','explain blue','ignore instructions','']) assert.throws(()=>validateStyleRequest(p));assert.equal(validateStyleRequest('calm ocean'),'calm ocean')});
test('server verifies identity, enforces entitlements, strips output and accepts transient BYOK',async()=>{
 let calls=0;const service=createStyleService({verifyIdToken:async token=>{if(token!=='valid')throw Error();return {uid:'u',email:'guest@example.com',email_verified:true}},ownerKey:'owner-secret',generate:async()=>{calls++;return JSON.stringify(themes[0])}});
 assert.equal((await service({token:'invalid',prompt:'paper'})).status,401);
 assert.equal((await service({token:'valid',prompt:'paper'})).status,403);
 assert.equal(calls,0);
 assert.deepEqual((await service({token:'valid',prompt:'paper',byok:'test-key-only'})).theme,themes[0]);
 assert.equal(calls,1);
});
test('malformed provider output never reaches client',async()=>{
 const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'a@b.com',email_verified:true}),approvedEmails:['a@b.com'],ownerKey:'fake',generate:async()=>'{"script":"bad"}'});
 const result=await service({token:'valid',prompt:'paper'});assert.equal(result.status,400);assert.equal(JSON.stringify(result).includes('script'),false);
});
test('adapter discards reasoning and refuses incomplete output',async()=>{
 const adapter=createCerebrasAdapter(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(themes[1]),reasoning:'private'}}]})));
 assert.equal(JSON.stringify(await adapter({key:'fake',prompt:'paper',maxCompletionTokens:512})).includes('private'),false);
});

test('provider request uses strict presentation schema and bounded parsed reasoning output',async()=>{
 let request;
 const adapter=createCerebrasAdapter(async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(themes[0])}}]}))});
 await adapter({key:'mock-only',prompt:'paper',maxCompletionTokens:512});
 assert.equal(request.reasoning_effort,'medium');assert.equal(request.max_completion_tokens,512);
 assert.equal(request.response_format.json_schema.strict,true);
 const schema=request.response_format.json_schema.schema;
 assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.radius.maximum,24);
 assert.deepEqual(schema.properties.layout.enum,['columns','stacked']);
 assert.equal('tasks' in schema.properties,false);
});
