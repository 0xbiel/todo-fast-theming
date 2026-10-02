import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {validateStyleRequest,validateTheme} from '../src/theme.js';
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
  let reservation,dispatched=false;
  try{
   let bytes=0;const chunks=[];
   for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){reply(413,{error:'Request too large.'});req.resume();return}chunks.push(chunk)}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['prompt','byok'].includes(k)))throw Error();
   const prompt=validateStyleRequest(body.prompt),key=body.byok;
   if(typeof key!=='string'||key.length<10||key.length>256)return reply(400,{error:'Enter your Cerebras key first.'});
   reservation=await ledger.reserve({uid:'local-device',lane:'byok',amount:0});
   await ledger.dispatch(reservation.id);dispatched=true;
   const result=await generate({key,prompt,maxCompletionTokens:MAX_COMPLETION_TOKENS,signal:AbortSignal.timeout(10000)});
   const usage=result?.usage;
   const excess=usage&&(!Number.isSafeInteger(usage.prompt_tokens)||usage.prompt_tokens<0||usage.prompt_tokens>MAX_INPUT_TOKENS||!Number.isSafeInteger(usage.completion_tokens)||usage.completion_tokens<0||usage.completion_tokens>MAX_COMPLETION_TOKENS);
   await ledger.settle(reservation.id,0,!!excess);
   if(excess||typeof result?.content!=='string'||result.content.length>4096)throw Error();
   const theme=validateTheme(JSON.parse(result.content));
   if(Object.values(theme).some(value=>typeof value==='string'&&value.includes(key)))throw Error();
   return reply(200,{theme});
  }catch(error){
   if(reservation){try{if(dispatched)await ledger.settle(reservation.id,0);else await ledger.cancel(reservation.id)}catch{}}
   return reply(error?.constructor?.name==='QuotaError'?429:400,{error:'Style unavailable. Check your key or try again within the request limit.'});
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
 return server;
}
