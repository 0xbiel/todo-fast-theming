import test from 'node:test';import assert from 'node:assert/strict';
import {createHostedHandler} from '../server/vercel.js';import {createSupabaseLedger} from '../server/supabase-ledger.js';import {createHostedSnapshotClient} from '../src/hosted-snapshots.js';import {themes} from '../src/theme.js';
function response(){return{headersSent:false,writeHead(status){this.status=status;this.headersSent=true},end(body){this.body=JSON.parse(body)}}}
test('hosted defaults fail closed without configuration and make no provider call',async()=>{
 let calls=0;const handler=createHostedHandler({env:{},providerFetch:async()=>calls++});const res=response();await handler({url:'/api/style',headers:{}},res);assert.equal(res.status,503);assert.equal(calls,0);
});
test('hosted auth, current policy and parsed JSON route enforce real boundaries',async()=>{
 let calls=0,commands=[];
 const client={auth:{getUser:async token=>({data:{user:token==='verified'?{id:'u',email:'owner@example.com',email_confirmed_at:'yes'}:null}})},rpc:async(_name,{command})=>{commands.push(command);return{data:command.op==='policy'?{enabled:true,approvedEmails:['owner@example.com'],rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000}}:command.op==='reserve'?{id:'reservation'}:{}}}};
 const handler=createHostedHandler({env:{APP_ORIGIN:'https://board.example',SUPABASE_URL:'https://db.example',SUPABASE_SERVER_KEY:'mock-server-only',ENABLE_HOSTED_AI:'true',CEREBRAS_API_KEY:'mock-owner-only'},clientFactory:()=>client,providerFetch:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(themes[0])}}],usage:{prompt_tokens:100,completion_tokens:100}}))}});
 const req={url:'/api/style',method:'POST',headers:{origin:'https://board.example','content-type':'application/json',authorization:'Bearer invalid'},body:{prompt:'ocean'}};
 let res=response();await handler(req,res);assert.equal(res.status,401);assert.equal(res.body.code,'auth');assert.equal(calls,0);
 res=response();await handler({...req,headers:{...req.headers,authorization:'Bearer verified'}},res);assert.equal(res.status,200);assert.equal(calls,1);assert.deepEqual(res.body.theme,themes[0]);
 assert.equal(JSON.stringify(commands).includes('mock-owner-only'),false);assert.equal(JSON.stringify(commands).includes('ocean'),false);assert.equal(commands.find(c=>c.op==='reserve').amount,7107);
 res=response();await handler({...req,headers:{...req.headers,authorization:'Bearer verified'},body:{prompt:'ocean',script:'x'}},res);assert.equal(res.status,400);assert.equal(calls,1);
});
test('remote snapshot client keeps owner token out of anonymous reads and private data out of publication',async()=>{
 const requests=[];const client=createHostedSnapshotClient(async()=>'verified-token',async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.endsWith('/api/snapshots')?{id:'a'.repeat(36)}:{snapshot:{version:1,tasks:[],theme:themes[0]}}))});
 await client.publish(themes[0]);await client.read('a'.repeat(36));assert.equal(requests[1].options.headers,undefined);assert.deepEqual(Object.keys(JSON.parse(requests[0].options.body)),['theme']);
});

