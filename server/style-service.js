import {validateStyleRequest,validateTheme,readableTheme} from '../src/theme.js';
import {decodeProviderTheme,outputValidationCode} from '../src/provider-theme.js';
import {themeSchema} from '../src/theme-schema.js';
import {safeVisualCssDiagnostics} from '../src/visual-diagnostics.js';
import {repairVisualTheme} from '../src/visual-design.js';
import {ProviderError} from './provider-errors.js';
import {QuotaError} from './errors.js';
export const MAX_INPUT_TOKENS=4096,MAX_COMPLETION_TOKENS=32768;
function cost(input,output,rates) {return Math.ceil((input*rates.inputMicrosPerMillion+output*rates.outputMicrosPerMillion)/1000000)}
export function createStyleService({verifyIdToken,generate,ownerKey,approvedEmails=[],ledger,rates,maxCompletionTokens=MAX_COMPLETION_TOKENS,previewDiagnostics=false}) {
 if(!Number.isSafeInteger(maxCompletionTokens)||maxCompletionTokens<2048||maxCompletionTokens>32768)throw Error('Invalid completion cap');
 if(!ledger) throw Error('Durable ledger required');
 if(!rates||!Object.values(rates).every(v=>Number.isSafeInteger(v)&&v>0)||!rates.inputMicrosPerMillion||!rates.outputMicrosPerMillion)throw Error('Reviewed provider price bounds required');
 const approved=new Set(approvedEmails.map(e=>e.trim().toLowerCase()));
 return async function handle(payload) {
  let reservation,dispatched=false,phase='request',diagnostic;
  try {
   if(!payload||Array.isArray(payload)||Object.keys(payload).some(k=>!['token','prompt','byok'].includes(k)))return {status:400,code:'scope',error:'Invalid request.'};
   const {token,prompt,byok}=payload;
   const request=validateStyleRequest(prompt);
   if(typeof token!=='string'||!token||token.length>8192)return {status:401,code:'auth',error:'Sign in required.'};
   let claims;try{claims=await verifyIdToken(token)}catch{return {status:401,code:'auth',error:'Sign in required.'}};
   if(typeof claims?.uid!=='string'||!claims.uid||claims.email_verified!==true||typeof claims.email!=='string')return {status:401,code:'auth',error:'Verified account required.'};
   if(byok!==undefined&&(typeof byok!=='string'||byok.length<10||byok.length>256))return {status:400,code:'key',error:'Invalid key.'};
   if(!byok&&!approved.has(claims.email.toLowerCase()))return {status:403,code:'approval',error:'Owner approval or your own key is required.'};
   const key=byok||ownerKey;
   if(!key)return {status:503,code:'setup',error:'Provider setup required.'};
   phase='accounting';
   reservation=await ledger.reserve({uid:claims.uid,email:claims.email,lane:byok?'byok':'shared',amount:byok?0:cost(MAX_INPUT_TOKENS,maxCompletionTokens,rates)});
   await ledger.dispatch(reservation.id);dispatched=true;
   phase='provider';
   const signal=AbortSignal.timeout(45000);
   let abortListener;
   const timedOut=new Promise((_,reject)=>{abortListener=()=>reject(Error('Timeout'));signal.addEventListener('abort',abortListener,{once:true})});
   let result;try{result=await Promise.race([generate({key,prompt:request,maxCompletionTokens,signal}),timedOut])}finally{signal.removeEventListener('abort',abortListener)}
   const content=typeof result==='string'?result:result?.content;
   const usage=result?.usage;
   let actual,trip=false;
   if(usage){
    const input=usage.prompt_tokens,output=usage.completion_tokens;
    if(Number.isSafeInteger(input)&&input>=0&&Number.isSafeInteger(output)&&output>=0){
     trip=input>MAX_INPUT_TOKENS||output>maxCompletionTokens;
     actual=byok?0:cost(input,output,rates);
    }else trip=true;
   }
   await ledger.settle(reservation.id,actual,trip);
   diagnostic={stage:'provider_result',finishReason:['stop','length','content_filter','tool_calls'].includes(result?.finishReason)?result.finishReason:result?.finishReason==null?'missing':'other',contentKind:typeof content==='string'?'text':content==null?'missing':'other',completionCap:maxCompletionTokens,inputCap:MAX_INPUT_TOKENS};
   if(typeof content==='string')diagnostic.contentLength=content.length;
   if(Number.isSafeInteger(usage?.completion_tokens)&&usage.completion_tokens>=0)diagnostic.completionTokens=usage.completion_tokens;
   if(Number.isSafeInteger(usage?.prompt_tokens)&&usage.prompt_tokens>=0)diagnostic.promptTokens=usage.prompt_tokens;
   phase='output';if(result?.failure){diagnostic.stage='finish_reason';throw new ProviderError(result.failure)}
   if(trip){diagnostic.stage='usage_bounds';throw Error('Invalid output')}
   if(typeof content!=='string'){diagnostic.stage='content_type';throw Error('Invalid output')}
   if(content.length>262144){diagnostic.stage='content_size';throw Error('Invalid output')}
   diagnostic.stage='theme_validation';
   let theme;try{const decoded=decodeProviderTheme(JSON.parse(content));theme=validateTheme(readableTheme(repairVisualTheme(decoded)))}catch(error){diagnostic.validation=outputValidationCode(error);if(previewDiagnostics===true)Object.assign(diagnostic,safeVisualCssDiagnostics(error));if(['visual.canvasCss','visual.cardCss','visual.headingCss','visual.titleCss','visual.sceneSvg','visual.cardSvg'].includes(error?.validationField))diagnostic.field=error.validationField;diagnostic.contentLength=content.length;throw error;}
   // Even a compromised provider cannot echo a secret in a presentation name.
   if([key,ownerKey].filter(Boolean).some(secret=>JSON.stringify(theme).includes(secret))){diagnostic.stage='secret_guard';throw Error('Invalid output')}
   return {status:200,theme};
  } catch(error) {
   if(!diagnostic&&['envelope_json','response_size','response_stream'].includes(error?.diagnosticStage))diagnostic={stage:error.diagnosticStage};
   if(reservation){try{if(dispatched)await ledger.settle(reservation.id);else await ledger.cancel(reservation.id)}catch{/* fail closed; reservation remains charged */}}
   const code=error instanceof QuotaError?(error.quotaCode==='safety_pause'?'safety_pause':'quota'):error instanceof ProviderError?error.code:phase==='request'?'scope':phase==='accounting'?'setup':phase==='provider'?(error?.name==='TimeoutError'||error?.message==='Timeout'?'network':'provider'):'output';
   return {status:['quota','safety_pause'].includes(code)?429:code==='scope'?400:code==='setup'?503:502,code,error:'Style request unavailable. Your current style is preserved.',...(diagnostic&&Object.keys(diagnostic).length?{diagnostic}:{})};
  }
 };
}
export async function readBoundedResponse(response,limit){
 if(!response.body?.getReader)throw Object.assign(new ProviderError('output'),{diagnosticStage:'response_stream'});
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Object.assign(new ProviderError('output'),{diagnosticStage:'response_size'});chunks.push(value)}return Buffer.concat(chunks).toString('utf8')}finally{await reader.cancel().catch(()=>{})}
}
// Explicitly enabled only by a separately configured live host. Never logs request bodies.
export function createCerebrasAdapter(fetchImpl=fetch) {
 return async ({key,prompt,maxCompletionTokens,signal})=>{
  const response=await fetchImpl('https://api.cerebras.ai/v1/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:'qwen-3.8-27b',reasoning_effort:'none',reasoning_format:'parsed',max_completion_tokens:maxCompletionTokens,response_format:{type:'json_schema',json_schema:{name:'board_theme',strict:true,schema:themeSchema}},messages:[{role:'system',content:'Create an original, art-directed visual redesign matching the requested material and mood. You may author rich CSS paint, typography and SVG artwork, not only change palette. Return only strict presentation JSON. Color tokens use {r,g,b} channels 0-255, never packed integers. Ivory is {r:250,g:248,b:240}; ink {r:40,g:40,b:40}. Use subtle realistic tones unless bold/neon is requested. Keep surface/text/muted/accent/urgentColor at readable contrast; these are opaque protected text surfaces. visual contains canvasCss, cardCss, headingCss, titleCss, sceneSvg, cardSvg. CSS fields are DECLARATIONS ONLY (no selectors/braces). Canvas allows background-color/image/size/position/repeat. Card additionally allows border-color/style/width/radius and box-shadow. Heading/title allow local font-family, font-weight/style, letter-spacing; heading also text-transform. Use expressive multilayer linear/radial/repeating gradients, paper grain, leather stitching, post-it shadows or editorial treatments. No url(), var(), imports, assets, layout/position/display/opacity/transforms, animations or !important in CSS. CSS px/%/deg only, never em/rem/vh/vw. Use explicit allowed longhand properties, not background/border/font shorthands; omit unsupported declarations. Maximum 12 declarations per field. Border<=4px, radius<=32px, shadows<=2 with each length<=24px. Letter-spacing must be 0px, 1px or 2px, never negative. Fonts may be Georgia, Garamond, Palatino, Arial, Verdana, Courier New, serif/sans-serif/monospace. SVG fields are complete decorative svg with viewBox="0 0 1000 1000", or empty string. Allowed tags: svg,g,defs,path,rect,circle,ellipse,line,polyline,polygon,linearGradient,radialGradient,stop,pattern. Paths/gradients/patterns can create original artwork. No text/image/use/script/foreignObject/filter/events/styles/external URLs. SVG paints are #RRGGBB, none, or local url(#id); local paint references only outside defs and paint servers; never inherit references into defs or a pattern/gradient. Pattern units userSpaceOnUse, effective spacing>=16 after patternTransform; max160 nodes, 400 total explicit/implicit path segments and points, 16000 characters each. Coordinates -2000..2000, stroke<=24. Explicit SVG line x1/y1/x2/y2. Style only; never return tasks, actions, executable code or explanatory text.'},{role:'user',content:prompt}]})});
  if(!response.ok)throw new ProviderError(response.status===401||response.status===403?'provider_auth':response.status===429?'provider_quota':response.status===400?'provider_config':'provider');
  const text=await readBoundedResponse(response,1048576);
  let data;try{data=JSON.parse(text)}catch{throw Object.assign(new ProviderError('output'),{diagnosticStage:'envelope_json'})}
  const finishReason=data.choices?.[0]?.finish_reason;
  return {content:data.choices?.[0]?.message?.content,usage:data.usage,finishReason,failure:finishReason==='stop'?undefined:finishReason==='length'?'output_limit':'output'}; // reasoning is intentionally discarded
 };
}

