import {UiError} from './ui-errors.js';
// One exchange per page load. Values never reach logs, messages or snapshots.
export function createAuthBootstrap(adapter,{readUrl,replaceUrl}){
 let initialized;
 const run=async()=>{
  const url=new URL(readUrl()),code=url.searchParams.get('code');
  const fragmentTokens=new URLSearchParams(url.hash.slice(1)).has('access_token');
  const callbackError=url.searchParams.has('error')||new URLSearchParams(url.hash.slice(1)).has('error');
  try{
   if(callbackError||fragmentTokens)throw new UiError('callback');
   if(code)await adapter.exchangeCode(code);
   // Explicit persisted-session reconciliation covers missing/delayed auth events.
   return await adapter.sessionUser();
  }catch{throw new UiError('callback')}
  finally{
   if(code||callbackError||fragmentTokens){for(const key of ['code','error','error_code','error_description'])url.searchParams.delete(key);if(callbackError||fragmentTokens)url.hash='';replaceUrl(url.pathname+url.search+url.hash)}
  }
 };
 return ()=>{if(!initialized)initialized=run().catch(error=>{initialized=null;throw error});return initialized};
}
export function observeAuth(adapter,bootstrap,{state,error,ready}){
 let active=true,revision=0;
 const subscription=adapter.subscribe((user,event)=>{revision++;if(active)state(user,event)});
 bootstrap().then(async()=>{
  const before=revision;const user=await adapter.sessionUser();
  if(active&&before===revision)state(user,'RECONCILED');
 }).catch(reason=>{if(active)error(reason)}).finally(()=>{if(active)ready()});
 return()=>{active=false;subscription.unsubscribe()};
}
