import test from 'node:test';import assert from 'node:assert/strict';
import {repairVisualCss,validateVisualCss} from '../src/visual-design.js';import {safeCssRepairs,cssRepairMessage} from '../src/visual-diagnostics.js';import {createStyleRequester} from '../src/style-client.js';import {createStyleService,createCerebrasAdapter,notebookCssSyntaxExample} from '../server/style-service.js';import {visualFixtures} from '../src/visual-fixture-data.js';

test('common valid gradient forms survive canonicalization without losing their image',()=>{
 for(const value of ['repeating-linear-gradient(to bottom,transparent -1px,transparent 31px,#cad8e4 31px,#cad8e4 32px)','linear-gradient(to bottom,rgba(120,150,170,.2) 0%,transparent 100%)','linear-gradient(to bottom,rgb(120 150 170 / 20%) 0%,transparent 100%)','radial-gradient(ellipse at 20% 30%,rgba(0,0,0,.05) 0px,transparent 1px),linear-gradient(to bottom,#fff,#eee)','repeating-linear-gradient(to bottom,#faf8f0 0 31px,#cad8e4 31px 32px)','linear-gradient(in srgb,#fff,#eee)']){
  const source='background-image:'+value;assert.equal(repairVisualCss(source,'canvas'),validateVisualCss(source,'canvas'));
 }
});
test('background shorthand expands layers, color, positions, sizes and repeats into bounded existing longhands',()=>{
 const source='background:linear-gradient(#fff,#eee) left top/50% 20px no-repeat,#faf8f0 repeating-linear-gradient(to bottom,transparent 0px,transparent 31px,#cad8e4 31px,#cad8e4 32px) 0 -2px/100% 32px repeat fixed';
 const result=repairVisualCss(source,'canvas');assert.match(result,/background-image:linear-gradient\(#fff,#eee\),repeating-linear-gradient/);assert.match(result,/background-color:#faf8f0/);assert.match(result,/background-size:50% 20px,100% 32px/);assert.match(result,/background-repeat:no-repeat,repeat/);assert.doesNotMatch(result,/attachment|fixed|background:/);assert.equal(validateVisualCss(result,'canvas'),result);
 for(const unsafe of ['background:url(https://evil.example)','background:linear-gradient(var(--secret),#fff)','background:linear-gradient(color-mix(in srgb,#fff,#000),#fff)','background:#fff;position:fixed'])assert.throws(()=>repairVisualCss(unsafe,'canvas'));
});
test('repair metadata identifies dropped image units and shorthand normalization without raw values',()=>{
 const repairs=[];const result=repairVisualCss('background-image:linear-gradient(#fff 0px,#eee 2rem);background-color:#fff','canvas',value=>repairs.push(value));assert.equal(result,'background-color:#fff');assert.deepEqual(safeCssRepairs(repairs),[{target:'canvas',action:'dropped',cssReason:'unit',cssProperty:'background-image',cssFeature:'rem'}]);
 const normalized=[];repairVisualCss('background:linear-gradient(#fff,#eee)','canvas',value=>normalized.push(value));assert.deepEqual(normalized,[{target:'canvas',action:'normalized',cssReason:'shorthand',cssProperty:'background'}]);
 assert.equal(cssRepairMessage([{target:'canvas',action:'dropped',cssReason:'mock-secret',cssProperty:'background-image'}]),'');
});
test('client repair summaries are allowlisted, bounded and do not alter the validated theme',async()=>{
 let received;const details=[{target:'canvas',action:'dropped',cssReason:'unit',cssProperty:'background-image',cssFeature:'rem',cssValue:'mock-secret'},{target:'mock-secret',action:'dropped',cssReason:'unit',cssProperty:'background-image'}];
 const result=await createStyleRequester()({prompt:'paper',getIdToken:async()=>'fixture',onCssRepairs:value=>{received=value},fetchImpl:async()=>new Response(JSON.stringify({theme:visualFixtures.notebook,cssRepairs:details}))});assert.deepEqual(result,visualFixtures.notebook);assert.equal(received.length,1);assert.doesNotMatch(JSON.stringify(received),/mock-secret|cssValue/);assert.match(cssRepairMessage(received),/dropped canvas background-image \(unit: rem\)/);
});
test('successful repair details are preview-only while normalization is identical',async()=>{
 const results=[];for(const previewDiagnostics of [false,true]){
  const theme={...visualFixtures.notebook,visual:{...visualFixtures.notebook.visual,canvasCss:'background-image:linear-gradient(#fff 0px,#eee 2rem);background-color:#fff'}};
  const service=createStyleService({previewDiagnostics,verifyIdToken:async()=>({uid:'u',email:'fixture@example.com',email_verified:true}),ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async()=>{}},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:async()=>({content:JSON.stringify(theme),finishReason:'stop',usage:{prompt_tokens:100,completion_tokens:100}})});
  const result=await service({token:'fixture',byok:'mock-key-only',prompt:'notebook paper'});assert.equal(result.status,200);assert.equal(!!result.cssRepairs,previewDiagnostics);results.push(result.theme);
 }assert.deepEqual(results[0],results[1]);
});
test('the model receives an exact validator-tested gradient syntax example without a substituted preset',async()=>{
 assert.equal(repairVisualCss(notebookCssSyntaxExample,'canvas'),validateVisualCss(notebookCssSyntaxExample,'canvas'));
 let request;const adapter=createCerebrasAdapter(async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]}))});await adapter({key:'mock-key',prompt:'notebook paper',maxCompletionTokens:32768});assert.ok(request.messages[0].content.includes(notebookCssSyntaxExample));assert.equal(request.messages[1].content,'notebook paper');assert.match(request.messages[0].content,/Adapt it creatively rather than returning a fixed preset/);
});
