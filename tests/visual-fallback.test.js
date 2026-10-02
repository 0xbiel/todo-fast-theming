import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {repairVisualTheme,VisualSvg} from '../src/visual-design.js';import {validateTheme} from '../src/theme.js';import {visualFixtures} from '../src/visual-fixture-data.js';
import {createStyleService} from '../server/style-service.js';import {createStyleRequester} from '../src/style-client.js';import {requestLocalStyle} from '../src/local-style-client.js';import {createStyleDispatcher} from '../src/style-mode.js';import {safeStyleWarnings,styleWarningMessage} from '../src/style-warnings.js';
const candidate=sceneSvg=>({...visualFixtures.notebook,visual:{...visualFixtures.notebook.visual,sceneSvg}});

test('invalid optional SVG is entirely absent from the validated theme and rendered output',()=>{
 for(const sceneSvg of ['<script>alert(1)</script>','<svg viewBox="0 0 1000 1000" onload="evil()"/>','<svg viewBox="0 0 1000 1000"><image href="https://private.example/secret"/></svg>','<!DOCTYPE svg SYSTEM "https://private.example/secret"><svg/>','<svg viewBox="0 0 1000 1000">'+'<rect/>'.repeat(161)+'</svg>']){
  const warnings=[];const theme=validateTheme(repairVisualTheme(candidate(sceneSvg),{warnings}));
  assert.equal(theme.visual.sceneSvg,'');assert.deepEqual(warnings,['scene_svg_removed']);assert.equal(renderToStaticMarkup(React.createElement(VisualSvg,{source:theme.visual.sceneSvg})),'');assert.doesNotMatch(JSON.stringify(theme),/private.example|secret|onload|alert/);
 }
});
test('valid optional artwork is preserved without warnings and both invalid layers produce fixed warnings',()=>{
 const warnings=[];const theme=repairVisualTheme(visualFixtures.leather,{warnings});assert.deepEqual(theme,visualFixtures.leather);assert.deepEqual(warnings,[]);
 const broken=candidate('<script/>');broken.visual.cardSvg='<foreignObject/>';const result=repairVisualTheme(broken,{warnings});assert.equal(result.visual.sceneSvg,'');assert.equal(result.visual.cardSvg,'');assert.deepEqual(warnings,['scene_svg_removed','card_svg_removed']);
});
test('optional decoration fallback never repairs malformed design structure or unsafe CSS',()=>{
 for(const sceneSvg of [null,{},[],42])assert.throws(()=>repairVisualTheme(candidate(sceneSvg)));
 assert.throws(()=>repairVisualTheme({...candidate('<script/>'),visual:{...candidate('<script/>').visual,script:'evil'}}));
 assert.throws(()=>validateTheme(repairVisualTheme({...candidate('<script/>'),tasks:[]})));
 assert.throws(()=>repairVisualTheme({...candidate('<script/>'),visual:{...candidate('<script/>').visual,canvasCss:'background-image:url(https://private.example)'}}));
});
test('a mocked provider decoration failure returns safe styling once, with settled usage and no raw output',async()=>{
 const output=candidate('<svg viewBox="0 0 1000 1000"><image href="https://private.example/mock-personal-key"/></svg>');let calls=0,settlements=0;
 const service=createStyleService({verifyIdToken:async()=>({uid:'u',email:'fixture@example.com',email_verified:true}),ledger:{reserve:async()=>({id:'r'}),dispatch:async()=>{},settle:async()=>settlements++},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:async()=>{calls++;return{content:JSON.stringify(output),finishReason:'stop',usage:{prompt_tokens:1162,completion_tokens:2108}}}});
 const result=await service({token:'fixture',byok:'mock-personal-key',prompt:'lined notebook paper'});assert.equal(result.status,200);assert.equal(calls,1);assert.equal(settlements,1);assert.deepEqual(result.warnings,['scene_svg_removed']);assert.equal(result.theme.visual.sceneSvg,'');assert.deepEqual(validateTheme(result.theme),result.theme);assert.doesNotMatch(JSON.stringify(result),/private.example|mock-personal-key|<image/);
});
test('hosted warning callbacks expose only fixed warning codes and preserve the validated theme contract',async()=>{
 let received;const warnings=['scene_svg_removed','private response <script>','scene_svg_removed'];
 const theme=await createStyleRequester()({prompt:'paper',getIdToken:async()=>'fixture',onWarnings:value=>{received=value},fetchImpl:async()=>new Response(JSON.stringify({theme:visualFixtures.notebook,warnings}))});
 assert.deepEqual(theme,visualFixtures.notebook);assert.deepEqual(received,['scene_svg_removed']);assert.match(styleWarningMessage(received),/background artwork was omitted/);assert.equal(styleWarningMessage(['private']), '');assert.deepEqual(safeStyleWarnings({scene_svg_removed:true}),[]);
});
test('local and hosted dispatch preserve warning callbacks without another provider request',async()=>{
 let received,calls=0;
 const dispatcher=createStyleDispatcher({localByokEnabled:true,liveAI:false,mockEnabled:false,local:(prompt,_current,options)=>requestLocalStyle({prompt,byok:'fixture-key',onWarnings:options.onWarnings,fetchImpl:async()=>{calls++;return new Response(JSON.stringify(calls===1?{capability:'fixture'}:{theme:visualFixtures.notebook,warnings:['card_svg_removed']}))}})});
 assert.deepEqual(await dispatcher('paper',visualFixtures.notebook,{onWarnings:value=>{received=value}}),visualFixtures.notebook);assert.deepEqual(received,['card_svg_removed']);assert.equal(calls,2);
});
