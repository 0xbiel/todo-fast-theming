import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {boardStyleSystemPrompt,createCerebrasAdapter,createStyleService,notebookCssSyntaxExample} from '../server/style-service.js';
import {themes,validateStyleRequest,validateTheme} from '../src/theme.js';
import {colorKeys} from '../src/provider-theme.js';
import {themeSchema} from '../src/theme-schema.js';
import {VisualStyles,VisualSvg} from '../src/visual-design.js';
import {visualFixtures} from '../src/visual-fixture-data.js';

const rgb=hex=>Object.fromEntries(['r','g','b'].map((key,index)=>[key,parseInt(hex.slice(index*2+1,index*2+3),16)]));
function wireTheme(theme){
 const {art,...wire}=theme;
 for(const key of colorKeys)wire[key]=rgb(theme[key]);
 return {...wire,name:'Custom'};
}
function mockedAdapter(content,inspect=()=>{}){
 return createCerebrasAdapter(async(_url,options)=>{
  inspect(JSON.parse(options.body));
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:200,completion_tokens:200}}));
 });
}
function mockedService(theme){
 return createStyleService({
  verifyIdToken:async()=>({uid:'fixture',email:'fixture@example.com',email_verified:true}),
  ledger:{reserve:async()=>({id:'fixture'}),dispatch:async()=>{},settle:async()=>{}},
  rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},
  generate:mockedAdapter(wireTheme(theme))
 });
}

// These tests inspect the actual provider payload and offline fixtures. They do
// not emulate model decisions or claim that live generation follows the prompt.
test('simple requests receive proportional instructions and explicit empty-art guidance',async()=>{
 for(const prompt of ['plain black with blue outlines','minimal blue style','rounded cards','compact layout','serif style']){
  let request;
  await mockedAdapter({},value=>{request=value})({key:'fixture-key',prompt:validateStyleRequest(prompt),maxCompletionTokens:32768});
  assert.equal(request.messages[0].content,boardStyleSystemPrompt);
  assert.equal(request.messages[1].content,prompt);
  assert.match(boardStyleSystemPrompt,/Default to the simplest treatment that satisfies the request/);
  assert.match(boardStyleSystemPrompt,/Plain, simple, flat, minimal, only and no decoration are constraints/);
  assert.match(boardStyleSystemPrompt,/All six visual fields are required by the schema but may be empty strings/);
  assert.match(boardStyleSystemPrompt,/with sceneSvg and cardSvg empty/);
  assert.match(boardStyleSystemPrompt,/plain black with blue outlines means flat black background and card surfaces, thin solid blue card borders/);
  assert.match(boardStyleSystemPrompt,/no grid, radar, geometric scene, glossy gradients, glow or uppercase headings/);
  assert.doesNotMatch(boardStyleSystemPrompt,/Create an original, art-directed visual redesign|Use expressive multilayer/);
  assert.equal(request.response_format.json_schema.strict,true);
  assert.deepEqual(request.response_format.json_schema.schema,themeSchema);
  assert.equal(request.reasoning_effort,'none');
  assert.equal(request.max_completion_tokens,32768);
 }
});

test('rich requested materials and scenes remain permitted without making every request decorative',()=>{
 assert.match(boardStyleSystemPrompt,/only when explicitly requested or clearly integral to a complex material or illustrated brief/);
 assert.match(boardStyleSystemPrompt,/a color or mood word alone does not request a literal scene/);
 assert.match(boardStyleSystemPrompt,/When the request calls for rich materials or illustration, you may author original multilayer gradients/);
 assert.match(boardStyleSystemPrompt,/leather background with post-it cards may use appropriate material texture, stitching and shadows/);
 assert.match(boardStyleSystemPrompt,/Only for a requested ruled-paper texture/);
 assert.ok(boardStyleSystemPrompt.includes(notebookCssSyntaxExample));
 assert.match(boardStyleSystemPrompt,/Never add this texture to unrelated or plain requests/);
 assert.match(boardStyleSystemPrompt,/Task controls and interactions belong to the application and must remain functional/);
 assert.match(boardStyleSystemPrompt,/No url\(\), var\(\), imports, assets, layout\/position\/display\/opacity\/transforms/);
});

test('offline plain-black blue-outline fixture survives strict service validation with no decorative SVG',async()=>{
 const flat=validateTheme({...themes[0],background:'#000000',surface:'#000000',accent:'#4d9cff',art:{angle:135,start:'#000000',end:'#000000',shapes:[]},visual:{
  canvasCss:'',cardCss:'border-color:#4d9cff;border-style:solid;border-width:1px;box-shadow:none',headingCss:'',titleCss:'',sceneSvg:'',cardSvg:''
 }});
 const result=await mockedService(flat)({token:'fixture',byok:'fixture-key',prompt:'plain black with blue outlines'});
 assert.equal(result.status,200);
 assert.equal(result.theme.background,'#000000');
 assert.equal(result.theme.surface,'#000000');
 assert.deepEqual(result.theme.art.shapes,[]);
 assert.equal(result.theme.art.start,result.theme.art.end);
 for(const field of ['canvasCss','headingCss','titleCss','sceneSvg','cardSvg'])assert.equal(result.theme.visual[field],'');
 assert.equal(result.theme.visual.cardCss,flat.visual.cardCss);
 const html=renderToStaticMarkup(React.createElement(React.Fragment,null,
  React.createElement(VisualStyles,{visual:result.theme.visual}),
  React.createElement(VisualSvg,{source:result.theme.visual.sceneSvg}),
  React.createElement(VisualSvg,{source:result.theme.visual.cardSvg})
 ));
 assert.match(html,/border-width:1px;box-shadow:none/);
 assert.doesNotMatch(html,/<svg|gradient|text-transform|font-weight/);
 assert.equal('tasks' in result.theme,false);
 assert.equal('actions' in result.theme,false);
});

test('offline expressive material fixture retains CSS textures and optional scene/card artwork',async()=>{
 const result=await mockedService(visualFixtures.leather)({token:'fixture',byok:'fixture-key',prompt:'leather background with post-it cards'});
 assert.equal(result.status,200);
 assert.deepEqual(result.theme.visual,visualFixtures.leather.visual);
 assert.match(result.theme.visual.canvasCss,/gradient/);
 assert.match(result.theme.visual.cardCss,/box-shadow/);
 assert.ok(result.theme.visual.sceneSvg);
 assert.ok(result.theme.visual.cardSvg);
 assert.equal('tasks' in result.theme,false);
});
