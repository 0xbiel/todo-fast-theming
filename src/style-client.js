import {validateStyleRequest,validateTheme} from './theme.js';
import {UiError,responseError} from './ui-errors.js';
export function createStyleRequester(){
 // One refresh per consecutive authentication failure, never a paid POST retry.
 let refreshAttempted=false;
 return async function requestStyle({prompt,getIdToken,refreshAuth,byok,fetchImpl=fetch}) {
  let request,token;
  try{request=validateStyleRequest(prompt)}catch{throw new UiError('scope')}
  try{token=await getIdToken()}catch{throw new UiError('auth')}
  let response;
  // Same-origin cookies let the hosting platform verify existing preview access.
  // The API still requires its verified bearer token; redirects are never followed.
  try{response=await fetchImpl('/api/style',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({prompt:request,...(byok?{byok}:{} )}),signal:AbortSignal.timeout(90000),cache:'no-store',credentials:'same-origin',redirect:'error'})}catch{throw new UiError('network')}
  if(!response.ok){
   let data;try{data=await response.json()}catch{}
   if(response.status===401){
    const apiAuth=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'&&data?.code==='auth';
    if(!apiAuth)throw new UiError('access');
    if(refreshAuth&&!refreshAttempted){
     refreshAttempted=true;
     try{await refreshAuth()}catch{throw new UiError('auth')}
     throw new UiError('auth_refreshed');
    }
    throw new UiError(refreshAttempted?'auth_rejected':'auth');
   }
   throw responseError(response.status,data?.code,data?.diagnostic);
  }
  refreshAttempted=false;
  try{return validateTheme((await response.json()).theme)}catch{throw new UiError('output',{stage:'client_validation'})}
 };
}
export const requestStyle=createStyleRequester();
