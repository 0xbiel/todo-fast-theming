import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {randomUUID} from 'node:crypto';import {createSupabaseLedger} from '../server/supabase-ledger.js';import {makeSnapshot} from '../src/capabilities.js';import {initialTasks} from '../src/storage.js';import {themes} from '../src/theme.js';
test('actual PostgreSQL migration denies browser roles and atomically enforces durable policy',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 await db.exec(await readFile(new URL('../supabase/migrations/202610020001_board_private.sql',import.meta.url),'utf8'));
 const command=async data=>(await db.query('SELECT public.board_command($1::jsonb) AS result',[JSON.stringify(data)])).rows[0].result;
 await db.exec('SET ROLE anon');await assert.rejects(command({op:'policy'}),/permission denied/);await assert.rejects(db.query('SELECT * FROM board_private.policy'),/permission denied/);
 await db.exec('RESET ROLE; SET ROLE authenticated');await assert.rejects(command({op:'policy'}),/permission denied/);
 await db.exec('RESET ROLE; SET ROLE service_role');assert.equal((await command({op:'policy'})).enabled,false);await assert.rejects(db.query('SELECT * FROM board_private.policy'),/permission denied/);
 const id=randomUUID(),uid='a'.repeat(64);
 await assert.rejects(command({op:'reserve',id,uid,lane:'shared',email:'owner@example.com',amount:7107}),/Quota unavailable/);
 await db.exec("RESET ROLE; UPDATE board_private.policy SET enabled=true,budget_micros=15000,per_minute=10,user_daily=10,global_daily=10,concurrent=1,approved_emails=ARRAY['owner@example.com']; SET ROLE service_role;");
 await assert.rejects(command({op:'reserve',id,uid,lane:'shared',amount:7107}),/Approval required/);
 await assert.rejects(command({op:'reserve',id,uid,lane:'shared',email:'owner@example.com',amount:1}),/Policy changed/);
 await command({op:'reserve',id,uid,lane:'shared',email:'owner@example.com',amount:7107});
 await assert.rejects(command({op:'reserve',id:randomUUID(),uid,lane:'byok',amount:0}),/Quota reached/);
 await command({op:'dispatch',id});await command({op:'cancel',id});await command({op:'settle',id,actualMicros:248});await command({op:'settle',id,actualMicros:0});
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT amount FROM board_private.reservations WHERE id=$1',[id])).rows[0].amount,248);
 const a=randomUUID(),b=randomUUID();await db.exec('SET ROLE service_role');await command({op:'reserve',id:a,uid,lane:'shared',email:'owner@example.com',amount:7107});await command({op:'dispatch',id:a});
 await db.exec("RESET ROLE; UPDATE board_private.reservations SET expires=now()-interval '1 second' WHERE id='"+a+"'; SET ROLE service_role");
 await command({op:'reserve',id:b,uid,lane:'shared',email:'owner@example.com',amount:7107});await command({op:'dispatch',id:b});await command({op:'settle',id:b});
 await assert.rejects(command({op:'reserve',id:randomUUID(),uid,lane:'shared',email:'owner@example.com',amount:7107}),/Budget reached/);
 const client={rpc:async(_name,{command:payload})=>{try{return{data:await command(payload)}}catch(error){return{error:{code:error.code}}}}};const one=createSupabaseLedger(client),two=createSupabaseLedger(client);
 const results=await Promise.allSettled([one.reserve({uid:'new',lane:'byok',amount:0}),two.reserve({uid:'new',lane:'byok',amount:0})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const byok=results.find(r=>r.status==='fulfilled').value;await one.cancel(byok.id);
 const snapshot=await one.publishSnapshot({owner:'owner',payload:makeSnapshot(initialTasks,themes[1])});assert.deepEqual((await two.readSnapshot(snapshot.id)).snapshot.theme,themes[1]);await assert.rejects(two.publishSnapshot({id:snapshot.id,owner:'other',payload:makeSnapshot(initialTasks,themes[0])}));await one.revokeSnapshot({id:snapshot.id,owner:'owner'});assert.equal((await two.readSnapshot(snapshot.id)).snapshot,null);
 await db.exec('RESET ROLE');const rows=(await db.query('SELECT * FROM board_private.reservations')).rows;assert.equal(JSON.stringify(rows).includes('owner@example.com'),false);assert.equal(JSON.stringify(rows).includes('new'),false);
});

test('reviewed lane migration gives shared 20 without expanding BYOK and keeps cap changes fail-closed',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 for(const file of ['202610020001_board_private.sql','202610020002_lane_limits.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec("UPDATE board_private.policy SET enabled=true,user_daily=3,global_daily=3,shared_user_daily=20,shared_global_daily=20,per_minute=3,concurrent=1,budget_micros=5000000,approved_emails=ARRAY['owner@example.com'];");
 const command=async data=>(await db.query('SELECT public.board_command($1::jsonb) AS result',[JSON.stringify(data)])).rows[0].result;
 assert.equal((await command({op:'policy'})).maxCompletionTokens,32768);
 const uid='a'.repeat(64),other='b'.repeat(64);
 async function consume(lane,user=uid){const id=randomUUID();await command({op:'reserve',id,uid:user,lane,email:lane==='shared'?'owner@example.com':undefined,amount:lane==='shared'?52880:0});await command({op:'dispatch',id});await command({op:'settle',id,actualMicros:lane==='shared'?100:0});await db.query("UPDATE board_private.reservations SET created=now()-interval '2 minutes' WHERE id=$1",[id]);}
 for(let i=0;i<3;i++)await consume('byok');
 await assert.rejects(consume('byok'),/Quota reached/);await assert.rejects(consume('byok',other),/Quota reached/);
 for(let i=0;i<20;i++)await consume('shared');
 await assert.rejects(consume('shared'),/Quota reached/);
 assert.equal((await db.query("SELECT count(*) AS n FROM board_private.reservations WHERE lane='shared'")).rows[0].n,20);
 assert.equal((await db.query("SELECT count(*) AS n FROM board_private.reservations WHERE lane='byok'")).rows[0].n,3);
 await db.exec('UPDATE board_private.policy SET completion_tokens=4096');assert.equal((await command({op:'policy'})).maxCompletionTokens,4096);
 await assert.rejects(command({op:'reserve',id:randomUUID(),uid:other,lane:'shared',email:'owner@example.com',amount:7107}),/Policy changed/);
 await assert.rejects(db.exec('UPDATE board_private.policy SET completion_tokens=100000'),/check constraint/);
 // No policy or credential values are published through the public/browser role.
 await db.exec('SET ROLE authenticated');await assert.rejects(command({op:'policy'}),/permission denied/);
});
