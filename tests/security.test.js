import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createDurableLedger} from '../server/ledger.js';
import {createStyleService,createCerebrasAdapter} from '../server/style-service.js';
import {createApiServer} from '../server/http.js';
import {supabaseVerifier} from '../server/auth.js';
import {themes} from '../src/theme.js';
async function setup(t,limits={}){const dir=await mkdtemp(join(tmpdir(),'board-security-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'ledger.sqlite');let now=Date.now();const options={path,clock:()=>now,limits:{globalBudgetMicros:10000,maxConcurrent:2,...limits}};return {ledger:createDurableLedger(options),restart:()=>createDurableLedger(options),path,advance:ms=>now+=ms}}
const identity={uid:'verified-user',email:'owner@example.com',email_verified:true};
const rates={inputMicrosPerMillion:1000000,outputMicrosPerMillion:1000000};
function service(ledger,generate,extra={}){return createStyleService({ledger,verifyIdToken:async()=>identity,ownerKey:'private-owner-key',approvedEmails:[identity.email],rates,generate,...extra})}
test('atomic concurrent reservations and restart retain global cap',async t=>{
 const {ledger,restart}=await setup(t,{maxConcurrent:10,globalBudgetMicros:100,perMinute:20});
 const results=await Promise.allSettled(Array.from({length:8},()=>ledger.reserve({uid:'same',lane:'shared',amount:60})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(restart().reserve({uid:'different',lane:'shared',amount:60}));
});
test('refund only before dispatch; settlement idempotent; actual usage releases unused budget',async t=>{
 const {ledger}=await setup(t);
 const a=await ledger.reserve({uid:'u',lane:'shared',amount:100});await ledger.cancel(a.id);await ledger.cancel(a.id);
 const b=await ledger.reserve({uid:'u',lane:'shared',amount:100});await ledger.dispatch(b.id);await ledger.cancel(b.id);
 let rows=(await ledger.inspect()).records;assert.equal(rows.find(r=>r.id===b.id).amount,100);
 await ledger.settle(b.id,30);await ledger.settle(b.id,0);
 rows=(await ledger.inspect()).records;assert.equal(rows.find(r=>r.id===a.id).amount,0);assert.equal(rows.find(r=>r.id===b.id).amount,30);
});
test('expired leases refund undispatched work and charge uncertain dispatched work',async t=>{
 const {ledger,advance,restart}=await setup(t);
 const a=await ledger.reserve({uid:'u',lane:'shared',amount:100});const b=await ledger.reserve({uid:'u',lane:'shared',amount:100});await ledger.dispatch(b.id);
 advance(61000);const rows=(await restart().inspect()).records;
 assert.equal(rows.find(r=>r.id===a.id).state,'cancelled');assert.equal(rows.find(r=>r.id===b.id).amount,100);assert.equal(rows.find(r=>r.id===b.id).state,'settled');
});
test('daily, rate, concurrency and zero-budget gates fail closed',async t=>{
 const {ledger}=await setup(t,{perMinute:1});await ledger.reserve({uid:'u',lane:'shared',amount:1});await assert.rejects(ledger.reserve({uid:'u',lane:'byok',amount:0}));
 const b=await setup(t,{perUserDaily:1});const r=await b.ledger.reserve({uid:'u',lane:'shared',amount:1});await b.ledger.cancel(r.id);b.advance(61000);await assert.rejects(b.ledger.reserve({uid:'u',lane:'shared',amount:1}));
 const c=await setup(t,{maxConcurrent:1});await c.ledger.reserve({uid:'u',lane:'byok',amount:0});await assert.rejects(c.ledger.reserve({uid:'v',lane:'byok',amount:0}));
 const d=await setup(t,{globalBudgetMicros:0});await assert.rejects(d.ledger.reserve({uid:'u',lane:'shared',amount:1}));
});
test('upstream failures retain conservative charge and never persist secrets/prompts',async t=>{
 const {ledger,path}=await setup(t);const result=await service(ledger,async()=>{throw Error('secret')})({token:'private-token',prompt:'editorial paper'});
 assert.equal(result.status,400);assert.equal((await ledger.inspect()).records[0].amount,6144);
 const raw=await readFile(path);for(const secret of ['private-owner-key','private-token','editorial paper','owner@example.com','verified-user'])assert.equal(raw.includes(Buffer.from(secret)),false);
});
test('actual provider usage refunds balance, excess usage trips durable circuit breaker',async t=>{
 const {ledger}=await setup(t);const ok=await service(ledger,async()=>({content:JSON.stringify(themes[0]),usage:{prompt_tokens:100,completion_tokens:100}}))({token:'t',prompt:'paper'});
 assert.equal(ok.status,200);assert.equal((await ledger.inspect()).records[0].amount,200);
 const bad=await service(ledger,async()=>({content:JSON.stringify(themes[0]),usage:{prompt_tokens:5000,completion_tokens:100}}))({token:'t',prompt:'paper'});assert.equal(bad.status,400);assert.equal((await ledger.inspect()).tripped,true);
 await assert.rejects(ledger.reserve({uid:'v',lane:'byok',amount:0}));
});
test('BYOK bypasses owner entitlement but never verified identity, quotas or transient handling',async t=>{
 const {ledger,path}=await setup(t);let calledKey;
 const run=service(ledger,async({key})=>{calledKey=key;return JSON.stringify(themes[0])},{approvedEmails:[]});
 assert.equal((await run({token:'t',prompt:'paper'})).status,403);
 assert.equal((await run({token:'t',prompt:'paper',byok:'transient-test-key'})).status,200);assert.equal(calledKey,'transient-test-key');
 assert.equal((await ledger.inspect()).records[0].amount,0);assert.equal((await readFile(path)).includes(Buffer.from('transient-test-key')),false);
});
test('Supabase verifier asks Auth server and requires confirmed email',async()=>{
 let seen;const verify=supabaseVerifier({auth:{getUser:async token=>{seen=token;return {data:{user:{id:identity.uid,email:identity.email,email_confirmed_at:'2026-01-01'}}}}}});
 assert.deepEqual(await verify('verified-token'),identity);assert.equal(seen,'verified-token');
 await assert.rejects(supabaseVerifier({auth:{getUser:async()=>({data:{user:{id:'u',email:'a@b.com'}},error:null})}})('t'));
 await assert.rejects(supabaseVerifier({auth:{getUser:async()=>({data:null,error:{message:'invalid'}})}})('t'));
});
test('provider output bounds and secret echoes are rejected',async t=>{
 const {ledger}=await setup(t);assert.equal((await service(ledger,async()=>JSON.stringify({...themes[0],name:'private-owner-key'}))({token:'t',prompt:'paper'})).status,400);
 const adapter=createCerebrasAdapter(async()=>new Response('x'.repeat(33000)));await assert.rejects(adapter({key:'x',prompt:'paper',maxCompletionTokens:512}));
});
test('HTTP enforces origin, token, JSON fields and body size before service',async t=>{
 let calls=0;const server=createApiServer({origin:'https://board.example',service:async()=>{calls++;return {status:200,theme:themes[0]}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const url=`http://127.0.0.1:${server.address().port}/api/style`;
 const send=(body,headers={})=>fetch(url,{method:'POST',headers:{Origin:'https://board.example','Content-Type':'application/json',Authorization:'Bearer test',...headers},body:JSON.stringify(body)});
 assert.equal((await send({prompt:'paper'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await send({prompt:'paper',token:'override'})).status,400);
 assert.equal((await send({prompt:'x'.repeat(5000)})).status,413);
 assert.equal((await send({prompt:'paper'})).status,200);assert.equal(calls,1);
});

import {createSnapshotService} from '../server/snapshots.js';
test('snapshot service uses examples, enforces owner-only republish/revoke and isolates public metadata',async t=>{
 const {ledger,restart}=await setup(t);const verifyIdToken=async token=>({uid:token,email_verified:true});
 const service=createSnapshotService({verifyIdToken,store:ledger});
 const original=structuredClone(themes[1]);const {id}=await service.publish({token:'owner',theme:original,tasks:[{title:'PRIVATE'}]});
 original.name='Changed';let snapshot=await service.read(id);assert.equal(snapshot.theme.name,'Paper');assert.equal(snapshot.tasks.length,5);
 assert.equal(JSON.stringify(snapshot).includes('PRIVATE'),false);assert.equal(snapshot.owner,undefined);assert.equal(snapshot.token,undefined);
 await assert.rejects(service.publish({token:'attacker',theme:themes[0],id}));await assert.rejects(service.revoke({token:'attacker',id}));
 await service.publish({token:'owner',theme:themes[2],id});assert.equal((await service.read(id)).theme.name,'Ocean');
 const again=createSnapshotService({verifyIdToken,store:restart()});assert.equal((await again.read(id)).theme.name,'Ocean');await again.revoke({token:'owner',id});assert.equal(await service.read(id),null);
});
