import {safeStyleWarnings} from './style-warnings.js';
import {UiError,responseError} from './ui-errors.js';
import {validateStyleRequest,validateTheme} from './theme.js';
export async function requestLocalStyle({prompt,byok,onWarnings,fetchImpl=fetch}) {
 const request=validateStyleRequest(prompt);
 if(!byok)throw Error('Add your Cerebras key in Account first.');
 const session=await fetchImpl('/api/local-session',{cache:'no-store',credentials:'omit'});
 if(!session.ok)throw Error('Local backend unavailable.');
 const {capability}=await session.json();
 const response=await fetchImpl('/api/local-style',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${capability}`},body:JSON.stringify({prompt:request,byok}),signal:AbortSignal.timeout(90000),cache:'no-store',credentials:'omit'});
 if(!response.ok){let data;try{data=await response.json()}catch{}throw responseError(response.status,data?.code,data?.diagnostic)}
 const data=await response.json();const theme=validateTheme(data.theme);onWarnings?.(safeStyleWarnings(data.warnings));return theme;
}

