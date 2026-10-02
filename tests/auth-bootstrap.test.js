import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthBootstrap,observeAuth} from '../src/auth-bootstrap.js';import {createSupabaseAdapter} from '../src/supabase-adapter.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('PKCE callback is exchanged once and reconciles persisted user when auth event is absent',async()=>{
 let exchanges=0,url='https://board.example/?code=mock-code&snapshot=safe';let user=null;
 const adapter={exchangeCode:async()=>{exchanges++;user={id:'verified'}},sessionUser:async()=>user};
 const bootstrap=createAuthBootstrap(adapter,{readUrl:()=>url,replaceUrl:path=>url='https://board.example'+path});
 const [one,two]=await Promise.all([bootstrap(),bootstrap()]);assert.equal(exchanges,1);assert.equal(one.id,'verified');assert.equal(two.id,'verified');assert.equal(new URL(url).searchParams.has('code'),false);
 const states=[];let ready=0;const stop=observeAuth({...adapter,subscribe:()=>({unsubscribe(){}})},bootstrap,{state:value=>states.push(value),error:()=>assert.fail(),ready:()=>ready++});await tick();assert.equal(states[0].id,'verified');assert.equal(ready,1);stop();
});
test('callback errors are sanitized/visible and can recover after a new sign-in',async()=>{
 let url='https://board.example/?code=bad',user=null;
 const adapter={exchangeCode:async()=>{throw Error('raw secret provider text')},sessionUser:async()=>user};const bootstrap=createAuthBootstrap(adapter,{readUrl:()=>url,replaceUrl:path=>url='https://board.example'+path});
 await assert.rejects(bootstrap(),error=>error.code==='callback'&&!error.message.includes('secret'));user={id:'recovered'};assert.equal((await bootstrap()).id,'recovered');
});
test('later sign-out wins over stale reconciliation and refresh events reach UI without token values',async()=>{
 let emit,release;const states=[];const adapter={subscribe:callback=>{emit=callback;return{unsubscribe(){}}},sessionUser:()=>new Promise(resolve=>release=resolve)};
 const stop=observeAuth(adapter,async()=>null,{state:(user,event)=>states.push({user,event}),error:()=>assert.fail(),ready:()=>{}});await tick();emit(null,'SIGNED_OUT');release({id:'stale'});await tick();assert.equal(states.length,1);assert.equal(states[0].user,null);emit({id:'new'},'TOKEN_REFRESHED');assert.equal(states.at(-1).event,'TOKEN_REFRESHED');stop();
});
test('SDK adapter restores persisted identity and exposes refresh independently of bearer values',async()=>{
 const adapter=createSupabaseAdapter({auth:{getSession:async()=>({data:{session:{user:{id:'u'},access_token:'mock-token'}}}),refreshSession:async()=>({data:{session:{user:{id:'u'}}}})}},'https://board.example/');
 assert.deepEqual(await adapter.sessionUser(),{id:'u'});assert.deepEqual(await adapter.refresh(),{id:'u'});
});
