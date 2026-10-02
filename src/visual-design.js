import * as css from 'css-tree';
import {DOMParser} from '@xmldom/xmldom';
import React,{useId} from 'react';
import {visualCssError} from './visual-diagnostics.js';

const cssTargets={
 canvas:new Set(['background-color','background-image','background-size','background-position','background-repeat']),
 card:new Set(['background-color','background-image','background-size','background-position','background-repeat','border-color','border-style','border-width','border-radius','box-shadow']),
 heading:new Set(['font-family','font-weight','font-style','letter-spacing','text-transform']),
 title:new Set(['font-family','font-weight','font-style','letter-spacing'])
};
const cssFunctions=new Set(['rgb','rgba','hsl','hsla','linear-gradient','radial-gradient','conic-gradient','repeating-linear-gradient','repeating-radial-gradient','repeating-conic-gradient']);
const fonts=new Set(['serif','sans-serif','monospace','cursive','Georgia','Times New Roman','Palatino','Garamond','Arial','Helvetica','Verdana','Trebuchet MS','Courier New','system-ui'].map(name=>name.toLowerCase()));
function validateFontFamilies(value){
 const families=[[]];
 value.children.forEach(node=>{if(node.type==='Operator'&&node.value===',')families.push([]);else families.at(-1).push(node)});
 for(const family of families){
  const name=family.length===1&&family[0].type==='String'?family[0].value:family.every(node=>node.type==='Identifier')?family.map(node=>node.name).join(' '):'';
  if(!fonts.has(name.toLowerCase()))throw visualCssError('font_family','font-family',name);
 }
}
export function validateVisualCss(text,target){
 if(typeof text!=='string')throw visualCssError('input_type');
 if(text.length>4000)throw visualCssError('length');
 if(!cssTargets[target])throw visualCssError('target');
 if(/[<>\\@]/.test(text))throw visualCssError('forbidden_syntax');
 let ast;try{ast=css.parse(text,{context:'declarationList',positions:false})}catch{throw visualCssError('parse')}
 let declarations=0,nodes=0;
 ast.children.forEach(decl=>{
  const fail=(reason,feature)=>{throw visualCssError(reason,decl.property,feature)};
  if(decl.type!=='Declaration')fail('node_type',decl.type);
  if(decl.important)fail('important');
  if(!cssTargets[target].has(decl.property))fail('property');
  if(++declarations>12)fail('declaration_limit');
  if(css.lexer.matchProperty(decl.property,decl.value).error)fail('grammar');
  if(decl.property==='box-shadow'&&decl.value.children.toArray().filter(n=>n.type==='Operator'&&n.value===',').length>1)fail('shadow_count');
  if(decl.property==='font-family')validateFontFamilies(decl.value);
  let functions=0;
  css.walk(decl.value,n=>{
   if(++nodes>400)fail('complexity');
   if(['Url','Raw','Atrule','Rule'].includes(n.type))fail('node',n.type);
   if(n.type==='Function'){
    if(!cssFunctions.has(n.name.toLowerCase()))fail('function',n.name);
    if(++functions>12)fail('function_count',n.name);
   }
   if(['Dimension','Number','Percentage'].includes(n.type)&&(!Number.isFinite(Number(n.value))||Math.abs(Number(n.value))>1000))fail('number_range',n.type);
   if(n.type==='Dimension'&&!['px','deg'].includes(n.unit.toLowerCase()))fail('unit',n.unit);
   if(['inherit','initial','unset','revert','revert-layer','currentcolor'].includes(n.name?.toLowerCase()))fail('global_keyword',n.name);
   if(decl.property==='box-shadow'&&n.type==='Dimension'&&Math.abs(Number(n.value))>24)fail('shadow_range');
   if(['border-width','border-radius','letter-spacing'].includes(decl.property)&&['Dimension','Number','Percentage'].includes(n.type)){
    const max=decl.property==='border-width'?4:decl.property==='border-radius'?32:2;
    if(n.type==='Percentage'||Number(n.value)<0||Number(n.value)>max)fail('length_range',n.type);
   }
  });
 });
 return css.generate(ast);
}

// Provider callers may simplify safe paint, then must run strict validation.
// Never repair network/dynamic features, executable syntax or layout/control CSS.
const cosmeticProperties=new Set([...Object.values(cssTargets).flatMap(values=>[...values]),'background','background-attachment','background-origin','background-clip','background-blend-mode','border','font','font-size','font-variant','line-height','color','text-shadow','text-decoration','text-align']);
const repairableReasons=new Set(['important','grammar','shadow_count','font_family','complexity','function_count','number_range','unit','global_keyword','shadow_range','length_range','declaration_limit']);
export function repairVisualCss(text,target){
 if(typeof text!=='string'||text.length>4000||!cssTargets[target]||/[<>\\@]/.test(text))return validateVisualCss(text,target);
 let ast;try{ast=css.parse(text,{context:'declarationList',positions:false})}catch{throw visualCssError('parse')}
 // Inspect the complete input before dropping any declaration, including overflow.
 ast.children.forEach(decl=>{
  if(decl.type!=='Declaration')throw visualCssError('node_type');
  if(!cosmeticProperties.has(decl.property.toLowerCase()))throw visualCssError('property',decl.property);
  css.walk(decl.value,node=>{
   if(['Url','Raw','Atrule','Rule'].includes(node.type))throw visualCssError('node',decl.property,node.type);
   if(node.type==='Function'&&!cssFunctions.has(node.name.toLowerCase()))throw visualCssError('function',decl.property,node.name);
  });
 });
 let result='';
 ast.children.forEach(decl=>{
  decl.property=decl.property.toLowerCase();
  if(!cssTargets[target].has(decl.property))return;
  decl.important=false;
  let discard=false;
  css.walk(decl.value,node=>{
   if(!['Dimension','Number','Percentage'].includes(node.type))return;
   const number=Number(node.value);
   if(!Number.isFinite(number)||node.type==='Dimension'&&!['px','deg'].includes(node.unit.toLowerCase())){discard=true;return}
   let min=-1000,max=1000;
   if(['border-width','border-radius','letter-spacing'].includes(decl.property)){
    if(node.type==='Percentage'){discard=true;return}
    min=0;max=decl.property==='border-width'?4:decl.property==='border-radius'?32:2;
   }else if(decl.property==='box-shadow'&&node.type==='Dimension'){min=-24;max=24;}
   const bounded=Math.max(min,Math.min(max,number));if(bounded!==number)node.value=String(bounded);
  });
  if(discard)return;
  const candidate=result+css.generate(decl)+';';
  try{result=validateVisualCss(candidate,target)+';'}catch(error){if(!repairableReasons.has(error.cssReason))throw error;}
 });
 return validateVisualCss(result,target);
}
export function repairVisualTheme(input){
 if(input?.visual===undefined)return input;
 const visual=input.visual,keys=['canvasCss','cardCss','headingCss','titleCss','sceneSvg','cardSvg'];
 if(!visual||Array.isArray(visual)||Object.keys(visual).length!==keys.length||Object.keys(visual).some(key=>!keys.includes(key)))throw Error('Invalid visual design');
 const result={...visual};
 for(const target of ['canvas','card','heading','title']){
  try{result[target+'Css']=repairVisualCss(visual[target+'Css'],target)}catch(error){throw Object.assign(error,{validationField:'visual.'+target+'Css'})}
 }
 // SVG and all other schema/geometry remain unchanged for strict validation.
 return {...input,visual:result};
}

const tags=new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','linearGradient','radialGradient','stop','pattern']);
const attrs=new Set(['viewBox','preserveAspectRatio','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','fill-opacity','stroke-opacity','d','points','x','y','x1','y1','x2','y2','cx','cy','fx','fy','r','rx','ry','width','height','transform','id','offset','stop-color','stop-opacity','gradientUnits','patternUnits','patternTransform','gradientTransform']);
const numberPattern=/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const numberList=value=>value.trim().split(/[ ,]+/).filter(Boolean);
const numbers=value=>numberList(value).length>0&&numberList(value).every(v=>numberPattern.test(v)&&Math.abs(Number(v))<=2000);
const resources=new Set(['defs','pattern','linearGradient','radialGradient']);
function minimumTransformScale(value=''){
 let scale=1;for(const match of value.matchAll(/scale\(([^)]+)\)/g)){const values=numberList(match[1]).map(Number);scale*=Math.min(...values)}return scale;
}
const color=value=>value==='none'||/^#[0-9a-f]{6}$/i.test(value);
const reactAttr={'stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin','stroke-dasharray':'strokeDasharray','fill-opacity':'fillOpacity','stroke-opacity':'strokeOpacity','stop-color':'stopColor','stop-opacity':'stopOpacity'};
export function parseVisualSvg(source){
 if(typeof source!=='string'||source.length>16000||/<!|<\?|&/.test(source))throw Error('Invalid visual SVG');
 if(!source.trim())return null;
 let doc;try{doc=new DOMParser({onError:()=>{throw Error('Invalid visual SVG')}}).parseFromString(source,'image/svg+xml')}catch{throw Error('Invalid visual SVG')}
 if(doc.documentElement?.tagName!=='svg'||doc.childNodes.length!==1)throw Error('Invalid visual SVG');
 let count=0,pathCommands=0;const ids=new Map(),refs=[];
 function walk(node,depth,inResource=false,inheritedReference=false){
  if(node.nodeType===3){if(node.data.trim())throw Error('Invalid visual SVG');return null}
  if(node.nodeType!==1||!tags.has(node.tagName)||depth>8||++count>160)throw Error('Invalid visual SVG');
  // Paint servers cannot inherit or contain references to any paint server.
  // This also covers resources declared outside <defs>.
  if(resources.has(node.tagName)&&inheritedReference)throw Error('Invalid visual SVG');
  inResource=inResource||resources.has(node.tagName);
  let hasReference=inheritedReference;
  const properties={};
  for(let i=0;i<node.attributes.length;i++){
   const {name,value}=node.attributes[i];
   if(name==='xmlns'&&depth===0&&value==='http://www.w3.org/2000/svg')continue;
   if(!attrs.has(name)||value.length>8000)throw Error('Invalid visual SVG');
   if(name==='id'){if(!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value)||ids.has(value))throw Error('Invalid visual SVG');ids.set(value,node.tagName)}
   else if(['fill','stroke'].includes(name)){const m=/^url\(#([A-Za-z][A-Za-z0-9_-]{0,31})\)$/.exec(value);if(m){if(inResource)throw Error('Invalid visual SVG');hasReference=true;refs.push(m[1])}else if(!color(value))throw Error('Invalid visual SVG')}
   else if(name==='stop-color'){if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid visual SVG')}
   else if(['opacity','fill-opacity','stroke-opacity','stop-opacity'].includes(name)){if(!numberPattern.test(value)||Number(value)<0||Number(value)>1)throw Error('Invalid visual SVG')}
   else if(name==='d'){
    const tokens=value.match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g)||[];
    if(value.replace(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[ ,\s]/g,'')||tokens.some(t=>numberPattern.test(t)&&Math.abs(Number(t))>2000))throw Error('Invalid visual SVG');
    if(!/^[Mm]/.test(tokens[0]||''))throw Error('Invalid visual SVG');
    const arity={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0};
    for(let j=0;j<tokens.length;){const command=tokens[j++].toUpperCase();if(!(command in arity))throw Error('Invalid visual SVG');let values=[];while(j<tokens.length&&!/^[A-Za-z]$/.test(tokens[j]))values.push(Number(tokens[j++]));const size=arity[command];if(size===0?values.length!==0:values.length===0||values.length%size!==0)throw Error('Invalid visual SVG');if((pathCommands+=size===0?1:values.length/size)>400)throw Error('Invalid visual SVG');if(command==='A')for(let k=0;k<values.length;k+=7)if(values[k]<0||values[k+1]<0||![0,1].includes(values[k+3])||![0,1].includes(values[k+4]))throw Error('Invalid visual SVG');}

   }else if(name==='points'){
    const values=numberList(value);if(!numbers(value)||values.length%2||(pathCommands+=values.length/2)>400)throw Error('Invalid visual SVG');
   }else if(['transform','patternTransform','gradientTransform'].includes(name)){
    if(value.length>180||! /^(?:(?:translate|rotate|scale)\([0-9eE., +\-]+\)\s*){1,3}$/.test(value)||!numbers(value.replace(/[A-Za-z]+\(|\)/g,' ')))throw Error('Invalid visual SVG');
    for(const match of value.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)){const vals=match[2].trim().split(/[ ,]+/).map(Number);if(match[1]==='scale'&&(vals.length>2||vals.some(x=>x<.25||x>4))||match[1]==='rotate'&&(![1,3].includes(vals.length)||Math.abs(vals[0])>360)||match[1]==='translate'&&vals.length>2)throw Error('Invalid visual SVG')}
   }else if(['gradientUnits','patternUnits'].includes(name)){if(!['userSpaceOnUse','objectBoundingBox'].includes(value))throw Error('Invalid visual SVG')}
   else if(name==='stroke-linecap'){if(!['butt','round','square'].includes(value))throw Error('Invalid visual SVG')}
   else if(name==='stroke-linejoin'){if(!['round','bevel','miter'].includes(value))throw Error('Invalid visual SVG')}
   else if(name==='preserveAspectRatio'){if(!['none','xMidYMid meet','xMidYMid slice'].includes(value))throw Error('Invalid visual SVG')}
   else if(name==='offset'){if(!/^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(value)||parseFloat(value)<0||parseFloat(value)>(value.endsWith('%')?100:1))throw Error('Invalid visual SVG')}
   else if(['x','y','x1','y1','x2','y2','cx','cy','fx','fy','r','width','height'].includes(name)&&/^\d+(?:\.\d+)?%$/.test(value)){if(parseFloat(value)>100||node.tagName==='pattern')throw Error('Invalid visual SVG')}
   else if(!numbers(value)||(!['viewBox','stroke-dasharray'].includes(name)&&numberList(value).length!==1))throw Error('Invalid visual SVG');
   if(name==='stroke-width'&&(Number(value)<0||Number(value)>24))throw Error('Invalid visual SVG');
   if(['width','height','r','rx','ry'].includes(name)&&Number(value)<0)throw Error('Invalid visual SVG');
   if(node.tagName==='pattern'&&['width','height'].includes(name)&&Number(value)<16)throw Error('Invalid visual SVG');
   properties[name]=value;
  }
  if(node.tagName==='pattern'&&(!properties.width||!properties.height||properties.patternUnits!=='userSpaceOnUse'||Math.min(Number(properties.width),Number(properties.height))*minimumTransformScale(properties.patternTransform)<16))throw Error('Invalid visual SVG');
  if(depth===0&&properties.viewBox!=='0 0 1000 1000')throw Error('Invalid visual SVG');
  const children=[];for(let n=node.firstChild;n;n=n.nextSibling){const c=walk(n,depth+1,inResource,hasReference);if(c)children.push(c)}
  return {tag:node.tagName,properties,children};
 }
 const tree=walk(doc.documentElement,0);if(refs.some(id=>!['linearGradient','radialGradient','pattern'].includes(ids.get(id))))throw Error('Invalid visual SVG');return tree;
}
export function validateVisualDesign(value){
 const keys=['canvasCss','cardCss','headingCss','titleCss','sceneSvg','cardSvg'];
 if(!value||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Invalid visual design');
 const result={};for(const target of ['canvas','card','heading','title']){try{result[target+'Css']=validateVisualCss(value[target+'Css'],target)}catch(error){throw Object.assign(error,{validationField:'visual.'+target+'Css'})}}
 for(const key of ['sceneSvg','cardSvg']){try{parseVisualSvg(value[key]);result[key]=value[key]}catch(error){throw Object.assign(error,{validationField:'visual.'+key})}}
 return result;
}
export function VisualSvg({source,className}){
 const prefix='art'+useId().replace(/[^a-zA-Z0-9_-]/g,'');const tree=parseVisualSvg(source);if(!tree)return null;
 const render=(node,index,root=false)=>{const props={key:index};for(const [key,val] of Object.entries(node.properties)){props[reactAttr[key]||key]=key==='id'?prefix+'-'+val:val.startsWith('url(#')?'url(#'+prefix+'-'+val.slice(5):val}
  if(root)Object.assign(props,{'aria-hidden':true,focusable:'false',className,preserveAspectRatio:'none'});
  return React.createElement(node.tag,props,...node.children.map((n,i)=>render(n,i)))};
 return render(tree,0,true);
}
export function VisualStyles({visual}){
 if(!visual)return null;const v=validateVisualDesign(visual);
 const stylesheet=`.visual-canvas{${v.canvasCss}}.visual-design .board .card{${v.cardCss}}.visual-design .heading h1{${v.headingCss}}.visual-design .board .task-title{${v.titleCss}}`;
 return React.createElement('style',null,stylesheet);
}
