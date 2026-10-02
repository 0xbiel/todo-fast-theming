import {createClient} from '@supabase/supabase-js';
import {createApiHandler} from './http.js';
import {createSupabaseLedger} from './supabase-ledger.js';
import {supabaseVerifier} from './auth.js';
import {createStyleService,createCerebrasAdapter} from './style-service.js';
import {createSnapshotService} from './snapshots.js';
export function createHostedHandler({env=process.env,clientFactory=createClient,providerFetch=fetch}={}){
 let dependencies;
 function setup(){
  if(dependencies)return dependencies;
  const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN||origin.username||origin.password)throw Error('Canonical HTTPS origin required');
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVER_KEY)throw Error('Server configuration required');
  const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(5000)})}};
  const client=clientFactory(env.SUPABASE_URL,env.SUPABASE_SERVER_KEY,options);
  const ledger=createSupabaseLedger(client),verifyIdToken=supabaseVerifier(client);
  dependencies={origin:origin.origin,ledger,verifyIdToken,snapshots:createSnapshotService({verifyIdToken,store:ledger})};return dependencies;
 }
 return async(req,res)=>{
  const fail=()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Hosted service needs setup.'}))}};
  try{
   const d=setup();
   const service=async payload=>{
    if(env.ENABLE_HOSTED_AI!=='true')return{status:503,error:'AI setup required.'};
    const policy=await d.ledger.policy();if(!policy?.enabled)return{status:503,error:'AI setup required.'};
    return createStyleService({verifyIdToken:d.verifyIdToken,ledger:d.ledger,ownerKey:env.CEREBRAS_API_KEY,approvedEmails:policy.approvedEmails,rates:policy.rates,maxCompletionTokens:policy.maxCompletionTokens??2048,previewDiagnostics:env.VERCEL_ENV==='preview',generate:createCerebrasAdapter(providerFetch)})(payload);
   };
   return await createApiHandler({origin:d.origin,service,snapshots:env.ENABLE_HOSTED_SHARING==='true'?d.snapshots:undefined})(req,res);
  }catch{fail()}
 };
}
export default createHostedHandler();

