import test from 'node:test';import assert from 'node:assert/strict';import {decodeProviderTheme,colorKeys,outputValidationCode} from '../src/provider-theme.js';import {themeSchema} from '../src/theme-schema.js';import {themes,validateTheme,readableTheme} from '../src/theme.js';import {responseError} from '../src/ui-errors.js';import {createStyleService,createCerebrasAdapter} from '../server/style-service.js';
function wire(){const t=themes[2],w={...t};for(const k of colorKeys)w[k]=parseInt(t[k].slice(1),16);w.art={angle:135,start:w.background,end:w.background,shapes:Object.fromEntries(Array.from({length:8},(_,i)=>['layer'+i,null]))};return w;}
test('constrained RGB and fixed decoration slots convert into bounded existing themes',()=>{
 const w=wire();w.art.shapes.layer0={kind:'ellipse',x:50,y:10,width:100,height:100,rotation:0,fill:16777215,stroke:0,opacity:.1};const t=validateTheme(readableTheme(decodeProviderTheme(w)));assert.equal(t.background,themes[2].background);assert.equal(t.art.shapes.length,1);assert.equal(t.art.shapes[0].fill,'#ffffff');
 assert.equal(themeSchema.$defs.color.maximum,16777215);assert.equal(themeSchema.properties.art.properties.shapes.required.length,8);assert.equal(themeSchema.properties.name.enum.every(x=>x.length<=40),true);
});
test('provider conversion never discards malicious fields or accepts excess geometry/colors',()=>{
 assert.throws(()=>decodeProviderTheme({...wire(),script:'malicious'}));const extra=wire();extra.art.shapes.layer8=null;assert.throws(()=>decodeProviderTheme(extra));assert.throws(()=>decodeProviderTheme({...wire(),background:16777216}));const shape=wire();shape.art.shapes.layer0={kind:'rect',x:0,y:0,width:1,height:1,rotation:0,fill:0,stroke:0,opacity:.1,onClick:'malicious'};assert.throws(()=>validateTheme(decodeProviderTheme(shape)));
});
test('diagnostics expose allowlisted categories only and preserve paid accounting',async()=>{
 let settlements=0;const service=createStyleService({verifyIdToken:async()=>({uid:'fixture',email:'fixture@example.com',email_verified:true}),ledger:{reserve:async()=>({id:'fixture'}),dispatch:async()=>{},settle:async()=>{settlements++}},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:async()=>({content:JSON.stringify({...wire(),background:-1}),usage:{prompt_tokens:100,completion_tokens:100},finishReason:'stop'})});
 const result=await service({token:'fixture',prompt:'calm ocean',byok:'mock-personal-key'});assert.equal(result.status,502);assert.equal(result.diagnostic.validation,'color');assert.ok(result.diagnostic.contentLength>0);assert.ok(settlements>=1);assert.equal(JSON.stringify(result).includes('mock-personal-key'),false);assert.equal(outputValidationCode(Error('secret raw output')),'json');assert.match(responseError(502,'output',result.diagnostic).message,/validation=color/);assert.equal(responseError(502,'output',{validation:'secret raw output'}).message.includes('secret'),false);
});

test('reported style prompts succeed through reasoning-off provider decoding without changing task fields',async()=>{
 const adapter=createCerebrasAdapter(async(_,options)=>{const r=JSON.parse(options.body);assert.equal(r.reasoning_effort,'none');assert.equal(r.max_completion_tokens,32768);assert.equal(r.reasoning_format,'parsed');return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire()),reasoning:'never displayed'}}],usage:{prompt_tokens:100,completion_tokens:100}}));});
 const service=createStyleService({verifyIdToken:async()=>({uid:'fixture',email:'fixture@example.com',email_verified:true}),ledger:{reserve:async()=>({id:'fixture'}),dispatch:async()=>{},settle:async()=>{}},rates:{inputMicrosPerMillion:990000,outputMicrosPerMillion:1490000},generate:adapter});
 for(const prompt of ['calm ocean','realistic calm ocean','leather background with post its as the cards']){const r=await service({token:'fixture',prompt,byok:'mock-personal-key'});assert.equal(r.status,200);assert.deepEqual(r.theme,themes[2]);assert.equal(JSON.stringify(r).includes('never displayed'),false);assert.equal('tasks' in r.theme,false);}
});


test('provider schema reuses bounded definitions to stay within the input reservation',()=>{
 const encoded=JSON.stringify(themeSchema);
 assert.ok(encoded.length<2500);
 assert.deepEqual(themeSchema.properties.background,{$ref:'#/$defs/color'});
 const shape=themeSchema.$defs.shape;
 assert.equal(shape.additionalProperties,false);assert.equal(shape.properties.opacity.maximum,.3);
 for(const slot of Object.values(themeSchema.properties.art.properties.shapes.properties))assert.deepEqual(slot,{anyOf:[{$ref:'#/$defs/shape'},{type:'null'}]});
 assert.deepEqual(shape.properties.fill,{$ref:'#/$defs/color'});
 assert.equal(themeSchema.$defs.color.minimum,0);assert.equal(themeSchema.$defs.color.maximum,16777215);
});
