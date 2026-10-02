import test from 'node:test';import assert from 'node:assert/strict';
import {validateVisualCss} from '../src/visual-design.js';
import {safeVisualCssDiagnostics} from '../src/visual-diagnostics.js';
import {safeDiagnosticText} from '../src/ui-errors.js';
import {visualFixtures} from '../src/visual-fixture-data.js';
import {createHostedHandler} from '../server/vercel.js';

test('CSS rejection explains known property and feature without echoing authored values',()=>{
 const cases=[
  ['background:#ffffff','canvas',{cssReason:'property',cssProperty:'background'}],
  ['background-size:1rem 1rem','canvas',{cssReason:'unit',cssProperty:'background-size',cssFeature:'rem'}],
  ['background-image:url(https://private.example/mock-personal-key)','canvas',{cssReason:'node',cssProperty:'background-image',cssFeature:'url'}],
  ['font-family:"mock-personal-key"','title',{cssReason:'font_family',cssProperty:'font-family',cssFeature:'other'}],
  ['mock-personal-key:1','canvas',{cssReason:'property',cssProperty:'other'}]
 ];
 for(const [value,target,expected] of cases){assert.throws(()=>validateVisualCss(value,target),error=>{assert.deepEqual(safeVisualCssDiagnostics(error),expected);assert.equal(JSON.stringify(error).includes('mock-personal-key'),false);return true})}
});
test('diagnostic extraction and UI accept only fixed CSS vocabulary',()=>{
 const secret='mock-private-key-or-task-content';
 assert.deepEqual(safeVisualCssDiagnostics({cssReason:secret,cssProperty:secret,cssFeature:secret,cssValue:secret}),{});
 assert.equal(safeDiagnosticText({cssReason:secret,cssProperty:secret,cssFeature:secret,cssValue:secret}),'');
 assert.match(safeDiagnosticText({cssReason:'unit',cssProperty:'background-size',cssFeature:'rem'}),/cssReason=unit, cssProperty=background-size, cssFeature=rem/);
});
test('hosted CSS diagnostics are preview-only, keep usage settlement and never expose rejected CSS',async()=>{
 for(const VERCEL_ENV of ['preview','production',undefined]){
  const ops=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'fixture-user',email:'fixture@example.com',email_confirmed_at:'yes'}}})},rpc:async(_name,{command})=>{ops.push(command.op);return{data:command.op==='policy'?{enabled:true,approvedEmails:['fixture@example.com'],rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000}}:command.op==='reserve'?{id:'fixture-reservation'}:{}}}};
  const theme={...visualFixtures.notebook,visual:{...visualFixtures.notebook.visual,canvasCss:'background-image:url(https://private.example/mock-secret)' }};
  const handler=createHostedHandler({env:{VERCEL_ENV,APP_ORIGIN:'https://board.example',SUPABASE_URL:'https://db.example',SUPABASE_SERVER_KEY:'mock-server-only',ENABLE_HOSTED_AI:'true',CEREBRAS_API_KEY:'mock-owner-only'},clientFactory:()=>client,providerFetch:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(theme)}}],usage:{prompt_tokens:100,completion_tokens:100}}))});
  const res={headersSent:false,writeHead(status){this.status=status;this.headersSent=true},end(body){this.body=JSON.parse(body)}};
  await handler({url:'/api/style',method:'POST',headers:{origin:'https://board.example','content-type':'application/json',authorization:'Bearer fixture-token'},body:{prompt:'notebook paper'}},res);
  assert.equal(res.status,502);assert.equal(res.body.diagnostic.validation,'visual_css');assert.equal(res.body.diagnostic.field,'visual.canvasCss');
  assert.equal(res.body.diagnostic.cssReason,VERCEL_ENV==='preview'?'node':undefined);assert.equal(res.body.diagnostic.cssFeature,VERCEL_ENV==='preview'?'url':undefined);
  assert.ok(ops.includes('settle'));assert.doesNotMatch(JSON.stringify(res.body),/mock-secret|private.example|mock-owner-only|mock-server-only|fixture-token|canvasCss:/);
 }
});
