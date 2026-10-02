// Provider wire format uses supported numeric/enum constraints, never CSS strings.
export const styleNames=['Custom','Ocean','Paper','Midnight','Rose','Editorial','Minimal','Warm','Cool','Geometric','Modern','Calm'];
export const colorKeys=['background','surface','text','muted','accent','urgentColor'];
export function decodeProviderTheme(input){
 if(!input||Array.isArray(input)||typeof input.background!=='number'&&typeof input.background!=='object')return input; // older bounded fixtures remain readable
 const generative=input.visual!==undefined&&input.art===undefined&&typeof input.background==='object';
 const keys=['name',...colorKeys,...(generative?[]:['art']),'radius','font','density','layout',...(input.visual!==undefined?['visual']:[])];
 if(Object.keys(input).length!==keys.length||Object.keys(input).some(k=>!keys.includes(k))||!styleNames.includes(input.name))throw Error('Unsupported presentation field');
 const color=v=>{if(v&&typeof v==='object'&&!Array.isArray(v)){if(Object.keys(v).length!==3||Object.keys(v).some(k=>!['r','g','b'].includes(k))||['r','g','b'].some(k=>!Number.isInteger(v[k])||v[k]<0||v[k]>255))throw Error('Invalid color');return '#'+['r','g','b'].map(k=>v[k].toString(16).padStart(2,'0')).join('')}if(!Number.isInteger(v)||v<0||v>16777215)throw Error('Invalid color');return '#'+v.toString(16).padStart(6,'0')};
 const result={...input};for(const k of colorKeys)result[k]=color(input[k]);
 if(generative){result.art={angle:135,start:result.background,end:result.background,shapes:[]};return result;}
 const art=input.art,slots=Array.from({length:8},(_,i)=>'layer'+i);
 if(!art||Array.isArray(art)||Object.keys(art).length!==(art.pattern===undefined?4:5)||Object.keys(art).some(k=>!['angle','start','end','pattern','shapes'].includes(k))||!art.shapes||Array.isArray(art.shapes)||Object.keys(art.shapes).length!==8||Object.keys(art.shapes).some(k=>!slots.includes(k)))throw Error('Invalid background art');
 result.art={...art,start:color(art.start),end:color(art.end),shapes:slots.map(k=>art.shapes[k]).filter(s=>s!==null).map(s=>({...s,fill:color(s?.fill),stroke:color(s?.stroke)}))};
 if(art.pattern!==undefined)result.art.pattern={...art.pattern,color:color(art.pattern?.color)};
 return result;
}
export function outputValidationCode(error){return ({'Invalid visual CSS':'visual_css','Invalid visual SVG':'visual_svg','Invalid visual design':'visual','Unsupported presentation field':'fields','Invalid color':'color','Invalid theme':'theme','Invalid layout':'layout','Invalid background art':'art','Invalid decorative shape':'shape','Invalid geometry':'geometry','Decoration out of bounds':'geometry','Priority color needs contrast':'priority_contrast','Text needs contrast':'text_contrast'})[error?.message]||'json';}

