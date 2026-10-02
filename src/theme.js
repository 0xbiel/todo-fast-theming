import {validateVisualDesign} from './visual-design.js';
import {validateArt} from './art.js';
export const themes = [
{ name: 'Midnight', background: '#101116', surface: '#191b23', text: '#f0f1f5', muted: '#9699ac', accent: '#a799ff', urgentColor: '#ff858b', radius: 12, font: 'sans', density: 'comfortable', layout: 'columns' },
{ name: 'Paper', background: '#eeeae1', surface: '#faf8f2', text: '#252b28', muted: '#70756e', accent: '#477b61', urgentColor: '#b7384a', radius: 6, font: 'serif', density: 'comfortable', layout: 'columns' },
{ name: 'Ocean', background: '#081f2b', surface: '#103241', text: '#e6f8fc', muted: '#85adbb', accent: '#6fdad0', urgentColor: '#6fdad0', radius: 20, font: 'sans', density: 'compact', layout: 'stacked' },
{ name: 'Rose', background: '#261b25', surface: '#382634', text: '#fff0f6', muted: '#bd9cac', accent: '#f4a5c1', urgentColor: '#f4a5c1', radius: 16, font: 'sans', density: 'comfortable', layout: 'columns' }
].map(theme=>({...theme,art:validateArt(undefined,theme.background)}));
export function validateTheme(input) {
 if(input&&typeof input==='object'&&!Array.isArray(input)&&input.urgentColor===undefined)input={...input,urgentColor:input.accent};
 const keys = ['name','background','surface','text','muted','accent','urgentColor','art','radius','font','density','layout',...(input?.visual!==undefined?['visual']:[])];
 if (!input || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k))) throw new Error('Unsupported presentation field');
 for (const key of ['background','surface','text','muted','accent','urgentColor']) if (!/^#[0-9a-f]{6}$/i.test(input[key])) throw new Error('Invalid color');
 if (typeof input.name !== 'string' || input.name.length > 40 || !Number.isInteger(input.radius) || input.radius < 0 || input.radius > 24 || !['sans','serif'].includes(input.font) || !['compact','comfortable'].includes(input.density)) throw new Error('Invalid theme');
 input={...input,art:validateArt(input.art,input.background)};
 if(input.visual!==undefined)input.visual=validateVisualDesign(input.visual);
 if(input.visual!==undefined&&(contrast(input.muted,input.surface)<4.5||contrast(input.accent,input.surface)<4.5))throw Error('Text needs contrast');
 if(contrast(input.urgentColor,input.surface)<4.5)throw Error('Priority color needs contrast');
 for(const background of [input.surface,input.art.start,input.art.end])if(contrast(input.text,background)<4.5)throw Error('Text needs contrast');
 if (!['columns','stacked'].includes(input.layout)) throw new Error('Invalid layout');
 return Object.fromEntries(keys.map(k => [k,input[k]]));
}
export async function generateMockTheme(prompt, current) {
 validateStyleRequest(prompt);
 await new Promise(resolve => setTimeout(resolve, 600));
 const match = /paper|light|editorial/i.test(prompt) ? themes[1] : /ocean|blue|teal/i.test(prompt) ? themes[2] : /pink|rose/i.test(prompt) ? themes[3] : themes[(themes.findIndex(t => t.name === current.name) + 1) % themes.length];
 const art=/gradient|svg|pattern|art|shape/i.test(prompt)?{angle:125,start:match.background,end:match.surface,shapes:[{kind:'ellipse',x:150,y:120,width:600,height:550,rotation:20,fill:match.accent,stroke:match.accent,opacity:.12},{kind:'line',x:100,y:850,width:950,height:100,rotation:0,fill:match.accent,stroke:match.accent,opacity:.2}]}:match.art;
 return validateTheme({...match,art,layout:/stack/i.test(prompt)?'stacked':match.layout});
}

export function validateStyleRequest(prompt) {
 if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 500 || /[?]|ignore|instructions|javascript|html|api.?key|secret|delete|add task|move task|explain|calculate|who is|what is|write (a|an)|weather/i.test(prompt) || !/random|paper|light|dark|editorial|ocean|blue|teal|pink|rose|minimal|calm|color|colour|style|look|layout|compact|serif|modern|midnight|warm|cool|green|purple|rounded|stack|background|gradient|svg|illustration|geometric|pattern|art|shape/i.test(prompt)) throw new Error('Describe only a visual style, for example calm ocean or editorial paper.');
 return prompt.trim();
}

export function contrast(a,b){const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}

// Repair color contrast with trusted, bounded color choices before strict validation.
// Executable fields, SVG geometry, schema and complexity limits are never repaired.
export function readableTheme(input){
 const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 if(!input||Array.isArray(input)||!hex(input.surface)||!hex(input.text))return input;
 const theme={...input};
 if(contrast(theme.text,theme.surface)<4.5)theme.text=contrast('#000000',theme.surface)>contrast('#ffffff',theme.surface)?'#000000':'#ffffff';
 if(hex(theme.urgentColor)&&contrast(theme.urgentColor,theme.surface)<4.5)theme.urgentColor=hex(theme.accent)&&contrast(theme.accent,theme.surface)>=4.5?theme.accent:theme.text;
 if(theme.visual!==undefined){for(const key of ['muted','accent'])if(hex(theme[key])&&contrast(theme[key],theme.surface)<4.5)theme[key]=theme.text;}
 if(theme.art&&typeof theme.art==='object'&&!Array.isArray(theme.art)){theme.art={...theme.art};for(const key of ['start','end'])if(hex(theme.art[key])&&contrast(theme.text,theme.art[key])<4.5)theme.art[key]=hex(theme.background)&&contrast(theme.text,theme.background)>=4.5?theme.background:theme.surface;}
 return theme;
}

