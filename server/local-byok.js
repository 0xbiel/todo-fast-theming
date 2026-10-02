import {repairVisualTheme} from '../src/visual-design.js';
import {decodeProviderTheme} from '../src/provider-theme.js';
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {validateStyleRequest,validateTheme,readableTheme} from '../src/theme.js';
import {ProviderError} from './provider-errors.js';
import {MAX_INPUT_TOKENS,MAX_COMPLETION_TOKENS} from './style-service.js';
// Local capability is not a Supabase account or an owner-key entitlement.
export function createLocalByokServer({origin='http://127.0.0.1:5173',ledger,generate}) {
 if(!['http://127.0.0.1:5173','http://localhost:5173'].includes(origin))throw Error('Loopback origin required');
 const expectedHost=new URL(origin).host,capability=randomBytes(32).toString('hex');
 const server=createServer(async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
  if(req.headers.host!==expectedHost)return reply(403,{error:'Local host required.'});
  if(req.url==='/api/local-session'&&req.method==='GET'){
   if(req.headers.origin&&req.headers.origin!==origin)return reply(403,{error:'Origin denied.'});
   return reply(200,{capability});
  }
  if(req.url!=='/api/local-style'||req.method!=='POST')return reply(404,{error:'Not found.'});
  if(req.headers.origin!==origin)return reply(403,{error:'Origin denied.'});
  if(req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding'])return reply(415,{error:'JSON required.'});
  const authorization=req.headers.authorization;
  const token=typeof authorization==='string'&&authorization.startsWith('Bearer ')?authorization.slice(7):'';
  const tokenBytes=Buffer.from(token),capabilityBytes=Buffer.from(capability);
  if(tokenBytes.length!==capabilityBytes.length||!timingSafeEqual(tokenBytes,capabilityBytes))return reply(401,{error:'Local capability required.'});
  let reservation,dispatched=false,phase='scope';
  try{
   let bytes=0;const chunks=[];
   for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){reply(413,{error:'Request too large.'});req.resume();return}chunks.push(chunk)}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['prompt','byok'].includes(k)))throw Error();
   const prompt=validateStyleRequest(body.prompt),key=body.byok;
   if(typeof key!=='string'||key.length<10||key.length>256)return reply(400,{error:'Enter your Cerebras key first.'});
   phase='setup';reservation=await ledger.reserve({uid:'local-device',lane:'byok',amount:0});
   await ledger.dispatch(reservation.id);dispatched=true;
   phase='provider';const result=await generate({key,prompt,maxCompletionTokens:MAX_COMPLETION_TOKENS,signal:AbortSignal.timeout(45000)});
   const usage=result?.usage;
   const excess=usage&&(!Number.isSafeInteger(usage.prompt_tokens)||usage.prompt_tokens<0||usage.prompt_tokens>MAX_INPUT_TOKENS||!Number.isSafeInteger(usage.completion_tokens)||usage.completion_tokens<0||usage.completion_tokens>MAX_COMPLETION_TOKENS);
   await ledger.settle(reservation.id,0,!!excess);
   phase='output';if(result?.failure)throw new ProviderError(result.failure);
   if(excess||typeof result?.content!=='string'||result.content.length>262144)throw Error();
   const warnings=[];const theme=validateTheme(readableTheme(repairVisualTheme(decodeProviderTheme(JSON.parse(result.content)),{warnings})));
   if(JSON.stringify(theme).includes(key))throw Error();
   return reply(200,{theme,...(warnings.length?{warnings}:{})});
  }catch(error){
   if(reservation){try{if(dispatched)await ledger.settle(reservation.id,0);else await ledger.cancel(reservation.id)}catch{}}
   const code=error?.constructor?.name==='QuotaError'?'quota':error instanceof ProviderError?error.code:phase;
   return reply(code==='quota'?429:code==='scope'?400:code==='setup'?503:502,{code,error:'Style unavailable. Your current design is preserved.'});
  }
 });
 server.requestTimeout=90000;server.headersTimeout=10000;server.maxHeadersCount=30;
 return server;
}

