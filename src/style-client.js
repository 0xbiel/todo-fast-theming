import {validateStyleRequest,validateTheme} from './theme.js';
// Optional integration adapter; mock UI does not activate it automatically.
export async function requestStyle({prompt,getIdToken,byok,fetchImpl=fetch}) {
 const request=validateStyleRequest(prompt),token=await getIdToken();
 const response=await fetchImpl('/api/style',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({prompt:request,...(byok?{byok}:{} )}),signal:AbortSignal.timeout(12000),cache:'no-store',credentials:'omit'});
 if(!response.ok)throw Error('Style unavailable');
 const result=await response.json();return validateTheme(result.theme);
}
