import {styleNames} from './provider-theme.js';
// Provider format contains only the expressive visual contract. Legacy art is
// derived internally, rather than repeating obsolete geometry in model input.
const channel={type:'integer',minimum:0,maximum:255};
const color={type:'object',additionalProperties:false,properties:{r:channel,g:channel,b:channel},required:['r','g','b']};
const rgb={$ref:'#/$defs/color'};
const visualKeys=['canvasCss','cardCss','headingCss','titleCss','sceneSvg','cardSvg'];
export const themeSchema={$defs:{color},type:'object',additionalProperties:false,properties:{name:{type:'string',enum:styleNames},background:rgb,surface:rgb,text:rgb,muted:rgb,accent:rgb,urgentColor:rgb,radius:{type:'integer',minimum:0,maximum:24},font:{type:'string',enum:['sans','serif']},density:{type:'string',enum:['compact','comfortable']},layout:{type:'string',enum:['columns','stacked']},visual:{type:'object',additionalProperties:false,properties:Object.fromEntries(visualKeys.map(k=>[k,{type:'string'}])),required:visualKeys}},required:['name','background','surface','text','muted','accent','urgentColor','radius','font','density','layout','visual']};
