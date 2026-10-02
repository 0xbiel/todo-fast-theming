import {validateStyleRequest,validateTheme} from './theme.js';
import {UiError,responseError} from './ui-errors.js';
export async function requestStyle({prompt,getIdToken,refreshAuth,byok,fetchImpl=fetch}) {
 let request,token;
 try{request=validateStyleRequest(prompt)}catch{throw new UiError('scope')}
 try{token=await getIdToken()}catch{throw new UiError('auth')}
 let response;
 try{response=await fetchImpl('/api/style',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({prompt:request,...(byok?{byok}:{} )}),signal:AbortSignal.timeout(90000),cache:'no-store',credentials:'omit'})}catch{throw new UiError('network')}
 if(!response.ok){
  if(response.status===401&&refreshAuth){try{await refreshAuth();throw new UiError('auth_refreshed')}catch(error){if(error instanceof UiError)throw error;throw new UiError('auth')}}
  let data;try{data=await response.json()}catch{}throw responseError(response.status,data?.code,data?.diagnostic);
 }
 try{return validateTheme((await response.json()).theme)}catch{throw new UiError('output')}
}
