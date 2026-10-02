import test from 'node:test';import assert from 'node:assert/strict';
import {repairVisualCss,repairVisualTheme,validateVisualCss} from '../src/visual-design.js';
import {visualFixtures} from '../src/visual-fixture-data.js';
import {validateTheme} from '../src/theme.js';
import {colorKeys} from '../src/provider-theme.js';
import {createStyleService} from '../server/style-service.js';
import {createHostedHandler} from '../server/vercel.js';
const wire=name=>{const theme={...visualFixtures[name],name:name==='notebook'?'Paper':'Warm',visual:{...visualFixtures[name].visual}};delete theme.art;for(const key of colorKeys)theme[key]=Object.fromEntries(['r','g','b'].map((channel,i)=>[channel,parseInt(theme[key].slice(1+2*i,3+2*i),16)]));return theme};

test('cosmetic repair clamps bounded lengths and revalidates the resulting declarations',()=>{
 assert.equal(repairVisualCss('letter-spacing:-.3px;font-family:Georgia','title'),'letter-spacing:0px;font-family:Georgia');
 assert.equal(repairVisualCss('letter-spacing:8px!important','title'),'letter-spacing:2px');
 assert.equal(repairVisualCss('border-radius:99px;border-width:10px;box-shadow:0px 2px 80px #000000','card'),'border-radius:32px;border-width:4px;box-shadow:0px 2px 24px #000000');
 for(const theme of Object.values(visualFixtures))for(const target of ['canvas','card','heading','title'])assert.equal(repairVisualCss(theme.visual[target+'Css'],target),validateVisualCss(theme.visual[target+'Css'],target));
});
test('benign unsupported paint, font and grammar declarations fall back without discarding valid paint',()=>{
 assert.equal(repairVisualCss('background-attachment:fixed;background:#ffffff;background-color:#faf8f0;background-size:2rem 2rem','canvas'),'background-color:#faf8f0');
 assert.equal(repairVisualCss('background-size:potato;background-color:#faf8f0','canvas'),'background-color:#faf8f0');
 assert.equal(repairVisualCss('font-family:Inter,sans-serif;letter-spacing:1px','title'),'letter-spacing:1px');
 assert.equal(repairVisualCss('border-radius:50%;border-color:#ffffff','card'),'border-color:#ffffff');
 assert.equal(repairVisualCss('background-color:inherit','canvas'),'');
});
test('repair never launders URLs, dynamic functions, executable syntax or layout-control properties',()=>{
 for(const value of ['background:url(https://evil.example)','background-color:var(--secret)','background-size:calc(100% - 1px)','display:none','position:fixed','pointer-events:none','opacity:0','transform:scale(0)','content:"spoof"','--secret:1','background-color:</style><script>','background-color:r\\65 d','@import "x"'])assert.throws(()=>repairVisualCss(value,'card'),value);
 assert.throws(()=>repairVisualCss('background-color:#ffffff;'.repeat(13)+'background:url(https://evil.example)','canvas'));
});
test('repair preserves strict schema and omits unsafe optional SVG instead of altering geometry',()=>{
 const theme={...visualFixtures.notebook,visual:{...visualFixtures.notebook.visual,titleCss:'letter-spacing:-1px'}};
 assert.equal(validateTheme(repairVisualTheme(theme)).visual.titleCss,'letter-spacing:0px');
 for(const sceneSvg of ['<script/>','<svg viewBox="0 0 1000 1000"><rect fill="url(https://evil.example)"/></svg>','<svg viewBox="0 0 1000 1000"><rect width="9999"/></svg>']){const candidate={...theme,visual:{...theme.visual,sceneSvg}};assert.throws(()=>validateTheme(candidate));assert.equal(validateTheme(repairVisualTheme(candidate)).visual.sceneSvg,'')}
 assert.throws(()=>repairVisualTheme({...theme,visual:{...theme.visual,script:'bad'}}));
 assert.throws(()=>validateTheme(repairVisualTheme({...theme,tasks:[]})));
});
test('notebook and leather cosmetic deviations succeed through paid-accounting boundaries with mocked inference',async()=>{
 for(const name of ['notebook','leather']){
  const output=wire(name);output.visual.titleCss+=';letter-spacing:-0.5px';output.visual.canvasCss+=';background-attachment:fixed';let dispatches=0,settlements=0;
  const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'fixture@example.com',email_verified:true}),ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>dispatches++,settle:async()=>settlements++},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:async()=>({content:JSON.stringify(output),finishReason:'stop',usage:{prompt_tokens:1115,completion_tokens:1939}})});
  const result=await service({token:'fixture',byok:'mock-personal-key',prompt:name==='notebook'?'lined notebook paper':'leather and post-its'});
  assert.equal(result.status,200);assert.deepEqual(validateTheme(result.theme),result.theme);assert.match(result.theme.visual.titleCss,/letter-spacing:0px/);assert.doesNotMatch(result.theme.visual.canvasCss,/background-attachment/);assert.equal(result.theme.visual.sceneSvg,output.visual.sceneSvg);assert.equal(dispatches,1);assert.equal(settlements,1);assert.equal('tasks' in result.theme,false);
 }
});
test('preview and production execute identical cosmetic normalization; only diagnostics differ',async()=>{
 const results=[];
 for(const VERCEL_ENV of ['preview','production']){
  const output=wire('notebook');output.visual.titleCss='letter-spacing:-1px';
  const client={auth:{getUser:async()=>({data:{user:{id:'u',email:'fixture@example.com',email_confirmed_at:'yes'}}})},rpc:async(_name,{command})=>({data:command.op==='policy'?{enabled:true,approvedEmails:['fixture@example.com'],rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000}}:command.op==='reserve'?{id:'r'}:{}})};
  const handler=createHostedHandler({env:{VERCEL_ENV,APP_ORIGIN:'https://board.example',SUPABASE_URL:'https://db.example',SUPABASE_SERVER_KEY:'mock-server',ENABLE_HOSTED_AI:'true',CEREBRAS_API_KEY:'mock-owner'},clientFactory:()=>client,providerFetch:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}],usage:{prompt_tokens:100,completion_tokens:100}}))});
  const res={headersSent:false,writeHead(status){this.status=status;this.headersSent=true},end(body){this.body=JSON.parse(body)}};
  await handler({url:'/api/style',method:'POST',headers:{origin:'https://board.example','content-type':'application/json',authorization:'Bearer fixture'},body:{prompt:'notebook paper'}},res);assert.equal(res.status,200);results.push(res.body.theme);
 }
 assert.deepEqual(results[0],results[1]);assert.equal(results[0].visual.titleCss,'letter-spacing:0px');
});
