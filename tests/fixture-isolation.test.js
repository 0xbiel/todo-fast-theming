import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild'; // The existing Vite compiler; no new installation or browser dependency.

const fullEnvironment={DEV:false,VITE_ENABLE_AUTH:'true',VITE_SUPABASE_URL:'https://fixture.invalid',VITE_SUPABASE_PUBLISHABLE_KEY:'fixture-public',VITE_ENABLE_LIVE_AI:'true',VITE_ENABLE_PUBLIC_SHARING:'true',VITE_ENABLE_LOCAL_BYOK:'true',VITE_ENABLE_GOOGLE_AUTH:'true',VITE_ENABLE_GITHUB_AUTH:'true'};

test('fixture entrypoint never initializes auth or touches real keys, snapshots, storage or network',async()=>{
 const result=await build({stdin:{contents:"export {App} from './src/main.jsx'; export * from './src/runtime.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',define:{'import.meta.env':JSON.stringify(fullEnvironment)},plugins:[{name:'isolated-fixture-test',setup(builder){
  builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture-test'}));
  builder.onResolve({filter:/^react-dom\/client$/},()=>({path:'react-dom',namespace:'fixture-test'}));
  builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase',namespace:'fixture-test'}));
  builder.onLoad({filter:/.*/,namespace:'fixture-test'},({path})=>({contents:path==='react'?`const createElement=(type,props,...children)=>({type,props:props||{},children});export const useState=initial=>[typeof initial==='function'?initial():initial,()=>{}];export const useEffect=callback=>callback();export const useRef=current=>({current});export const useId=()=> 'fixture';export default {createElement,Fragment:'fragment'};`:path==='react-dom'?`export function createRoot(){throw Error('Unexpected automatic mount')}`:`export function createClient(){throw Error('Unexpected live auth initialization')}`}));
  builder.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }}]});
 const names=['location','document','window','localStorage','fetch'];
 const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 let reads=0,requests=0;
 try{
  const forbidden=()=>{reads++;throw Error('Unexpected persistent/browser state access')};
  Object.defineProperties(globalThis,{
   location:{configurable:true,value:{pathname:'/visual-fixtures.html',hostname:'127.0.0.1',get search(){return forbidden()}}},
   document:{configurable:true,value:{getElementById:id=>id==='fixture-root'?{}:null,addEventListener(){},removeEventListener(){}}},
   window:{configurable:true,value:new Proxy({},{get:forbidden})},
   localStorage:{configurable:true,value:new Proxy({},{get:forbidden})},
   fetch:{configurable:true,value:()=>{requests++;throw Error('Unexpected network request')}}
  });
  for(const pathname of ['/visual-fixtures.html','/visual-fixtures']){
  location.pathname=pathname;
  const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n//# sourceURL=fixture-isolation.bundle.js').toString('base64')+'#'+pathname);
  assert.equal(module.authentication,null);assert.equal(module.authEnabled,false);assert.equal(module.liveAI,false);assert.equal(module.localByokEnabled,false);assert.equal(module.hostedSharing,false);
  const tree=module.App({fixtureMode:true});
  const elements=[];const collect=value=>{if(Array.isArray(value)){value.forEach(collect);return}if(value&&typeof value==='object'){elements.push(value);collect(value.children)}};collect(tree);
  const buttons=elements.filter(node=>node.type==='button');
  assert.equal(buttons.find(node=>node.children.includes('Account')).props.disabled,true);
  assert.equal(buttons.some(node=>node.children.includes('Revoke')),false);
  for(const node of buttons)if(node.props.onClick&&!node.props.disabled)await node.props.onClick({preventDefault(){}});
  for(const node of elements)if(node.type==='form'&&node.props.onSubmit)await node.props.onSubmit({preventDefault(){}});
  assert.throws(()=>module.generateStyle('paper',{}));
  assert.equal(reads,0);assert.equal(requests,0);
  }
 }finally{for(const name of names){const descriptor=saved.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}}
});
