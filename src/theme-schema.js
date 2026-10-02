import {styleNames} from './provider-theme.js';
// Cerebras does not constrain string patterns/lengths or array lengths. Numeric
// RGB and eight nullable named layers make these bounds enforceable in decoding.
// Shared definitions keep the provider prompt compact without changing its constraints.
const color={type:'integer',minimum:0,maximum:16777215,description:'RGB color encoded as integer: red*65536 + green*256 + blue. Black=0, white=16777215.'};
const rgb={$ref:'#/$defs/color'};
const shape={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['ellipse','rect','line']},x:{type:'number',minimum:0,maximum:1000},y:{type:'number',minimum:0,maximum:1000},width:{type:'number',minimum:0,maximum:1000},height:{type:'number',minimum:0,maximum:1000},rotation:{type:'number',minimum:0,maximum:360},fill:rgb,stroke:rgb,opacity:{type:'number',minimum:0,maximum:0.3}},required:['kind','x','y','width','height','rotation','fill','stroke','opacity']};
const slots=Array.from({length:8},(_,i)=>'layer'+i);
export const themeSchema={$defs:{color,shape},type:'object',additionalProperties:false,properties:{name:{type:'string',enum:styleNames},background:rgb,surface:rgb,text:rgb,muted:rgb,accent:rgb,urgentColor:rgb,art:{type:'object',additionalProperties:false,properties:{angle:{type:'integer',minimum:0,maximum:360},start:rgb,end:rgb,shapes:{type:'object',additionalProperties:false,properties:Object.fromEntries(slots.map(k=>[k,{anyOf:[{$ref:'#/$defs/shape'},{type:'null'}]}])),required:slots}},required:['angle','start','end','shapes']},radius:{type:'integer',minimum:0,maximum:24},font:{type:'string',enum:['sans','serif']},density:{type:'string',enum:['compact','comfortable']},layout:{type:'string',enum:['columns','stacked']}},required:['name','background','surface','text','muted','accent','urgentColor','art','radius','font','density','layout']};

