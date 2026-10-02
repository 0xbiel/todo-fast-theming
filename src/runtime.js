import {createClient} from '@supabase/supabase-js';
import {createHostedSnapshotClient} from './hosted-snapshots.js';
import {createSupabaseAdapter} from './supabase-adapter.js';
import {requestLocalStyle} from './local-style-client.js';
import {requestStyle} from './style-client.js';
import {generateMockTheme} from './theme.js';
const env=import.meta.env;
export const authEnabled=env.VITE_ENABLE_AUTH==='true'&&!!env.VITE_SUPABASE_URL&&!!env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const localByokEnabled=env.VITE_ENABLE_LOCAL_BYOK==='true'&&['127.0.0.1','localhost'].includes(location.hostname);
export const liveAI=authEnabled&&env.VITE_ENABLE_LIVE_AI==='true';
export const passwordlessMode=['link','code'].includes(env.VITE_PASSWORDLESS_MODE)?env.VITE_PASSWORDLESS_MODE:null;
const client=authEnabled?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:'pkce',detectSessionInUrl:false}}):null;
export const authentication=client?createSupabaseAdapter(client,location.origin+location.pathname):null;
export async function completeAuthRedirect(){
 if(!authentication)return;
 const url=new URL(location.href),code=url.searchParams.get('code');
 if(code){try{await authentication.exchangeCode(code)}finally{url.searchParams.delete('code');history.replaceState(null,'',url.pathname+url.search+url.hash)}}
}
export async function generateStyle(prompt,current){
 if(localByokEnabled)return requestLocalStyle({prompt,byok:localStorage.getItem('board-studio.byok')||undefined});
 if(!liveAI)return generateMockTheme(prompt,current);
 const byok=localStorage.getItem('board-studio.byok')||undefined;
 return requestStyle({prompt,getIdToken:authentication.token,byok});
}

export const hostedSharing=env.VITE_ENABLE_PUBLIC_SHARING==='true';
export const hostedSnapshots=createHostedSnapshotClient(()=>authentication?.token());
