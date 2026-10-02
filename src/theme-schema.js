// Cerebras strict JSON schema subset. String color/name bounds are additionally
// enforced by validateTheme; unsupported pattern/length keywords are omitted.
export const themeSchema={
 type:'object',additionalProperties:false,
 properties:{
  name:{type:'string'},background:{type:'string'},surface:{type:'string'},
  text:{type:'string'},muted:{type:'string'},accent:{type:'string'},urgentColor:{type:'string'},
  art:{type:'object',additionalProperties:false,properties:{angle:{type:'integer',minimum:0,maximum:360},start:{type:'string'},end:{type:'string'},shapes:{type:'array',items:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['ellipse','rect','line']},x:{type:'number',minimum:0,maximum:1000},y:{type:'number',minimum:0,maximum:1000},width:{type:'number',minimum:0,maximum:1000},height:{type:'number',minimum:0,maximum:1000},rotation:{type:'number',minimum:0,maximum:360},fill:{type:'string'},stroke:{type:'string'},opacity:{type:'number',minimum:0,maximum:0.3}},required:['kind','x','y','width','height','rotation','fill','stroke','opacity']}}},required:['angle','start','end','shapes']},
  radius:{type:'integer',minimum:0,maximum:24},
  font:{type:'string',enum:['sans','serif']},
  density:{type:'string',enum:['compact','comfortable']},
  layout:{type:'string',enum:['columns','stacked']}
 },
 required:['name','background','surface','text','muted','accent','urgentColor','art','radius','font','density','layout']
};
