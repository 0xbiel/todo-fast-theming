// Cerebras strict JSON schema subset. String color/name bounds are additionally
// enforced by validateTheme; unsupported pattern/length keywords are omitted.
export const themeSchema={
 type:'object',additionalProperties:false,
 properties:{
  name:{type:'string'},background:{type:'string'},surface:{type:'string'},
  text:{type:'string'},muted:{type:'string'},accent:{type:'string'},
  radius:{type:'integer',minimum:0,maximum:24},
  font:{type:'string',enum:['sans','serif']},
  density:{type:'string',enum:['compact','comfortable']},
  layout:{type:'string',enum:['columns','stacked']}
 },
 required:['name','background','surface','text','muted','accent','radius','font','density','layout']
};
