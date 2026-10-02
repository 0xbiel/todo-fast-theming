import {validateStyleRequest,validateTheme} from '../src/theme.js';
import {themeSchema} from '../src/theme-schema.js';
import {QuotaError} from './ledger.js';
export const MAX_INPUT_TOKENS=4096,MAX_COMPLETION_TOKENS=2048;
function cost(input,output,rates) {return Math.ceil((input*rates.inputMicrosPerMillion+output*rates.outputMicrosPerMillion)/1000000)}
export function createStyleService({verifyIdToken,generate,ownerKey,approvedEmails=[],ledger,rates}) {
 if(!ledger) throw Error('Durable ledger required');
 if(!rates||!Object.values(rates).every(v=>Number.isSafeInteger(v)&&v>0)||!rates.inputMicrosPerMillion||!rates.outputMicrosPerMillion)throw Error('Reviewed provider price bounds required');
 const approved=new Set(approvedEmails.map(e=>e.trim().toLowerCase()));
 return async function handle(payload) {
  let reservation,dispatched=false;
  try {
   if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!['token','prompt','byok'].includes(k)))return {status:400,error:'Invalid request.'};
   const {token,prompt,byok}=payload;
   const request=validateStyleRequest(prompt);
   if(typeof token!=='string'||!token||token.length>8192)return {status:401,error:'Sign in required.'};
   let claims;try{claims=await verifyIdToken(token)}catch{return {status:401,error:'Sign in required.'}};
   if(typeof claims?.uid!=='string'||!claims.uid||claims.email_verified!==true||typeof claims.email!=='string')return {status:401,error:'Verified account required.'};
   if(byok!==undefined&&(typeof byok!=='string'||byok.length<10||byok.length>256))return {status:400,error:'Invalid key.'};
   if(!byok&&!approved.has(claims.email.toLowerCase()))return {status:403,error:'Owner approval or your own key is required.'};
   const key=byok||ownerKey;
   if(!key)return {status:503,error:'Provider setup required.'};
   reservation=await ledger.reserve({uid:claims.uid,lane:byok?'byok':'shared',amount:byok?0:cost(MAX_INPUT_TOKENS,MAX_COMPLETION_TOKENS,rates)});
   await ledger.dispatch(reservation.id);dispatched=true;
   const signal=AbortSignal.timeout(10000);
   let abortListener;
   const timedOut=new Promise((_,reject)=>{abortListener=()=>reject(Error('Timeout'));signal.addEventListener('abort',abortListener,{once:true})});
   let result;try{result=await Promise.race([generate({key,prompt:request,maxCompletionTokens:MAX_COMPLETION_TOKENS,signal}),timedOut])}finally{signal.removeEventListener('abort',abortListener)}
   const content=typeof result==='string'?result:result?.content;
   const usage=result?.usage;
   let actual,trip=false;
   if(usage){
    const input=usage.prompt_tokens,output=usage.completion_tokens;
    if(Number.isSafeInteger(input)&&input>=0&&Number.isSafeInteger(output)&&output>=0){
     trip=input>MAX_INPUT_TOKENS||output>MAX_COMPLETION_TOKENS;
     actual=byok?0:cost(input,output,rates);
    }else trip=true;
   }
   await ledger.settle(reservation.id,actual,trip);
   if(trip||typeof content!=='string'||content.length>4096)throw Error('Invalid output');
   const theme=validateTheme(JSON.parse(content));
   // Even a compromised provider cannot echo a secret in a presentation name.
   if(Object.values(theme).some(value=>typeof value==='string'&&(value.includes(key)||(ownerKey&&value.includes(ownerKey)))))throw Error('Invalid output');
   return {status:200,theme};
  } catch(error) {
   if(reservation){try{if(dispatched)await ledger.settle(reservation.id);else await ledger.cancel(reservation.id)}catch{/* fail closed; reservation remains charged */}}
   return {status:error instanceof QuotaError?429:400,error:'Style request unavailable. Your current style is preserved.'};
  }
 };
}
export async function readBoundedResponse(response,limit){
 if(!response.body?.getReader)throw Error('Missing response stream');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Response too large');chunks.push(value)}return Buffer.concat(chunks).toString('utf8')}finally{await reader.cancel().catch(()=>{})}
}
// Explicitly enabled only by a separately configured live host. Never logs request bodies.
export function createCerebrasAdapter(fetchImpl=fetch) {
 return async ({key,prompt,maxCompletionTokens,signal})=>{
  const response=await fetchImpl('https://api.cerebras.ai/v1/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:'qwen-3.8-27b',reasoning_effort:'medium',reasoning_format:'parsed',max_completion_tokens:maxCompletionTokens,response_format:{type:'json_schema',json_schema:{name:'board_theme',strict:true,schema:themeSchema}},messages:[{role:'system',content:'Return ONLY a JSON presentation object with name (short style name), background/surface/text/muted/accent (#RRGGBB colors), radius (integer 0-24), font (sans or serif), density (compact or comfortable), layout (columns or stacked). Never return task content, code, HTML, URLs, explanations, or instructions. Only visual design is allowed.'},{role:'user',content:prompt}]})});
  if(!response.ok) throw Error('Provider unavailable');
  const text=await readBoundedResponse(response,32768);
  const data=JSON.parse(text);
  if(data.choices?.[0]?.finish_reason!=='stop') throw Error('Incomplete style');
  return {content:data.choices[0].message.content,usage:data.usage}; // reasoning is intentionally discarded
 };
}
