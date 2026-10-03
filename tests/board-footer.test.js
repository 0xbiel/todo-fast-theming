import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';

test('board footer shows only the perspective while AI status and controls remain available',async()=>{
 const result=await build({
  stdin:{contents:"export {App} from './src/main.jsx'; export {configure} from './src/runtime.js';",resolveDir:process.cwd()},
  bundle:true,write:false,format:'cjs',platform:'node',packages:'external',
  plugins:[{name:'offline-board-render',setup(builder){
   builder.onResolve({filter:/^react-dom\/client$/},()=>({path:'mount',namespace:'footer-test'}));
   builder.onResolve({filter:/\/runtime\.js$/},()=>({path:'runtime',namespace:'footer-test'}));
   builder.onLoad({filter:/.*/,namespace:'footer-test'},({path})=>({contents:path==='mount'
    ? 'export function createRoot(){throw Error("Unexpected automatic mount")}'
    : `export let authEnabled=false,googleAuthEnabled=false,githubAuthEnabled=false,liveAI=false,mockEnabled=false,hostedSharing=false,localByokEnabled=false;
       export const hostedSnapshots={},passwordlessMode=null,authentication=null,completeAuthRedirect=async()=>null;
       export function generateStyle(){throw Error('Unexpected provider call')}
       export function configure(mode){liveAI=mode==='live';localByokEnabled=mode==='byok';mockEnabled=mode==='mock';}`
   }));
   builder.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  }}]
 });
 const saved=Object.getOwnPropertyDescriptor(globalThis,'document');
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:()=>null}});
  const module={exports:{}};
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const {App,configure}=module.exports;
  for(const [mode,status] of [['setup','Setup required'],['live','Sign-in required'],['byok','BYOK ready'],['mock','Dev mock']]){
   configure(mode);
   const html=renderToStaticMarkup(React.createElement(App,{fixtureMode:true}));
   const footer=html.match(/<div class="board-footer">(.*?)<\/div>/)?.[1];
   assert.equal(footer,'<span>✦ Midnight perspective</span>',mode);
   assert.doesNotMatch(html,/Saved on this device/);
   assert.ok(html.includes('<span class="demo-badge">'+status+'</span>'),mode);
   assert.match(html,/<div role="status" class="feedback">/);
   assert.match(html,/class="pill-caption"/);
   for(const label of ['Requested board style','Dictate style','Random','Undo','Restyle ↗'])assert.ok(html.includes(label),label);
  }
 }finally{
  if(saved)Object.defineProperty(globalThis,'document',saved);else delete globalThis.document;
 }
});
