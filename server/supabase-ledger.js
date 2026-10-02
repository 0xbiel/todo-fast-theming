import {createHash,randomUUID} from 'node:crypto';
import {QuotaError} from './errors.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
// Only hashed identifiers and accounting/sanitized snapshots reach this RPC.
export function createSupabaseLedger(client){
 async function command(payload){const {data,error}=await client.rpc('board_command',{command:payload});if(error){if(error.code==='P0001')throw Object.assign(new QuotaError('Usage limit reached'),{quotaCode:error.message==='Quota unavailable'?'safety_pause':'quota'});throw Error('Accounting unavailable')}return data}
 return {
  policy:()=>command({op:'policy'}),
  reserve:({uid,email,lane,amount})=>command({op:'reserve',id:randomUUID(),uid:hash(uid),email:lane==='shared'?email:undefined,lane,amount}),
  dispatch:id=>command({op:'dispatch',id}),cancel:id=>command({op:'cancel',id}),
  settle:(id,actualMicros,trip=false)=>command({op:'settle',id,actualMicros,trip}),
  publishSnapshot:({id=randomUUID(),owner,payload})=>command({op:'snapshotPublish',id,owner:hash(owner),payload}),
  readSnapshot:id=>command({op:'snapshotRead',id}),
  revokeSnapshot:({id,owner})=>command({op:'snapshotRevoke',id,owner:hash(owner)})
 };
}

