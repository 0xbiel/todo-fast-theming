import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {QuotaError} from './errors.js';
export {QuotaError} from './errors.js';
export function createDurableLedger({path,clock=Date.now,limits={}}) {
 if(!isAbsolute(path)) throw Error('Absolute durable database path required');
 const settings={perMinute:5,perUserDaily:30,globalDaily:100,maxConcurrent:2,globalBudgetMicros:0,leaseMs:60000,...limits};
 for(const value of Object.values(settings)) if(!Number.isSafeInteger(value)||value<0) throw Error('Invalid limit');
 if(settings.leaseMs<60000) throw Error('Lease must exceed request timeout');
 async function command(data) {
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  return new Promise((resolve,reject)=>{
   const child=spawn('python3',[fileURLToPath(new URL('./ledger.py',import.meta.url)),path],{stdio:['pipe','pipe','ignore']});
   let output='';const timer=setTimeout(()=>{child.kill();reject(Error('Accounting unavailable'))},10000);
   child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000)child.kill()});
   child.on('error',()=>{clearTimeout(timer);reject(Error('Accounting unavailable'))});
   child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error();const result=JSON.parse(output);if(result.error)reject(new QuotaError('Usage limit reached'));else resolve(result)}catch{reject(Error('Accounting unavailable'))}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...data,now:clock()}));
  });
 }
 return {
  reserve:({uid,lane,amount})=>{
   if(typeof uid!=='string'||!uid||!['shared','byok'].includes(lane)||!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid reservation');
   return command({op:'reserve',id:randomUUID(),uid:createHash('sha256').update(uid).digest('hex'),lane,amount,day:new Date(clock()).toISOString().slice(0,10),limits:settings});
  },
  dispatch:id=>command({op:'dispatch',id}),cancel:id=>command({op:'cancel',id}),
  settle:(id,actualMicros,trip=false)=>command({op:'settle',id,actualMicros,trip}),
  inspect:()=>command({op:'inspect'}),
  publishSnapshot:({id=randomUUID(),owner,payload})=>command({op:'snapshotPublish',id,owner:createHash('sha256').update(owner).digest('hex'),payload}),
  readSnapshot:id=>command({op:'snapshotRead',id}),
  revokeSnapshot:({id,owner})=>command({op:'snapshotRevoke',id,owner:createHash('sha256').update(owner).digest('hex')})
 };
}
