// All transmitted details are fixed vocabulary, never provider-authored values.
export const visualCssDiagnostics={
 cssReason:['input_type','length','target','forbidden_syntax','parse','node_type','important','property','declaration_limit','grammar','shadow_count','font_family','complexity','node','function','function_count','number_range','unit','global_keyword','shadow_range','length_range'],
 cssProperty:['other','background','background-color','background-image','background-size','background-position','background-repeat','background-blend-mode','border','border-color','border-style','border-width','border-radius','border-top','border-bottom','box-shadow','color','font','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-transform','text-shadow','padding','margin','width','height','min-height','opacity','display','position','transform','filter','animation','transition','pointer-events','z-index','mix-blend-mode','box-sizing'],
 cssFeature:['other','url','raw','atrule','rule','var','calc','min','max','clamp','color-mix','light-dark','image-set','rgb','rgba','hsl','hsla','linear-gradient','radial-gradient','conic-gradient','repeating-linear-gradient','repeating-radial-gradient','repeating-conic-gradient','px','deg','em','rem','vh','vw','vmin','vmax','ch','ex','cm','mm','in','pt','pc','turn','rad','grad','inherit','initial','unset','revert','revert-layer','currentcolor','inter','georgia','times new roman','palatino','garamond','arial','helvetica','verdana','trebuchet ms','courier new','system-ui','serif','sans-serif','monospace','cursive','percentage','dimension','number']
};
export function safeVisualCssDiagnostics(value){
 const result={};for(const [key,allowed] of Object.entries(visualCssDiagnostics))if(allowed.includes(value?.[key]))result[key]=value[key];return result;
}
export function visualCssError(reason,property,feature){
 const known=(key,value)=>visualCssDiagnostics[key].includes(value)?value:'other';
 return Object.assign(Error('Invalid visual CSS'),{cssReason:reason,...(property?{cssProperty:known('cssProperty',property.toLowerCase())}:{}),...(feature?{cssFeature:known('cssFeature',feature.toLowerCase())}:{})});
}
