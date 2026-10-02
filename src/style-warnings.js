const warnings=['scene_svg_removed','card_svg_removed'];
export function safeStyleWarnings(value){return Array.isArray(value)?warnings.filter(code=>value.includes(code)):[]}
export function styleWarningMessage(value){
 const known=safeStyleWarnings(value);if(!known.length)return '';
 const artwork=known.length===2?'background and card':known[0]==='scene_svg_removed'?'background':'card';
 return ' Some '+artwork+' artwork was omitted because it could not be safely rendered.';
}
