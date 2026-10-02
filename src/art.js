import React,{useId} from 'react';
const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function validateArt(art,background){
 if(art===undefined)return {angle:135,start:background,end:background,shapes:[]};
 if(!art||Array.isArray(art)||Object.keys(art).some(k=>!['angle','start','end','pattern','shapes'].includes(k))||!Number.isInteger(art.angle)||art.angle<0||art.angle>360||!hex(art.start)||!hex(art.end)||!Array.isArray(art.shapes)||art.shapes.length>8)throw Error('Invalid background art');
 const keys=['kind','x','y','width','height','rotation','fill','stroke','opacity'];
 const shapes=art.shapes.map(shape=>{
  if(!shape||Object.keys(shape).length!==keys.length||Object.keys(shape).some(k=>!keys.includes(k))||!['ellipse','rect','line'].includes(shape.kind)||!hex(shape.fill)||!hex(shape.stroke))throw Error('Invalid decorative shape');
  for(const k of ['x','y','width','height','rotation','opacity'])if(typeof shape[k]!=='number'||!Number.isFinite(shape[k]))throw Error('Invalid geometry');
  if(shape.x<0||shape.x>1000||shape.y<0||shape.y>1000||shape.width<0||shape.width>1000||shape.height<0||shape.height>1000||shape.rotation<0||shape.rotation>360||shape.opacity<0||shape.opacity>.3)throw Error('Decoration out of bounds');
  return {...shape};
 });
 let pattern;
 if(art.pattern!==undefined){const p=art.pattern;if(!p||Array.isArray(p)||Object.keys(p).length!==4||Object.keys(p).some(k=>!['kind','color','spacing','opacity'].includes(k))||!['none','ruled','grid','dots'].includes(p.kind)||!hex(p.color)||!Number.isInteger(p.spacing)||p.spacing<16||p.spacing>64||typeof p.opacity!=='number'||!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>.25)throw Error('Invalid background art');pattern={...p};}
 return {angle:art.angle,start:art.start,end:art.end,shapes,...(pattern?{pattern}:{})};
}
// Trusted renderer: no raw SVG markup, external URL references, events or foreignObject.
// Repeating patterns use only a generated local ID and validated geometry.
export function BackgroundArt({art}){
 const patternId='paper-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const p=art.pattern;
 const pattern=p&&p.kind!=='none'?React.createElement('svg',{'aria-hidden':true,className:'background-art'},React.createElement('defs',null,React.createElement('pattern',{id:patternId,patternUnits:'userSpaceOnUse',width:p.spacing,height:p.spacing},p.kind==='dots'?React.createElement('circle',{cx:1,cy:1,r:1,fill:p.color}):React.createElement('path',{d:p.kind==='grid'?`M 0 0 H ${p.spacing} M 0 0 V ${p.spacing}`:`M 0 0 H ${p.spacing}`,stroke:p.color,strokeWidth:1,fill:'none'}))),React.createElement('rect',{width:'100%',height:'100%',fill:`url(#${patternId})`,opacity:p.opacity})):null;
 return React.createElement(React.Fragment,null,pattern,React.createElement('svg',{'aria-hidden':true,className:'background-art',viewBox:'0 0 1000 1000',preserveAspectRatio:'none'},art.shapes.map((s,i)=>{
  const common={key:i,fill:s.fill,stroke:s.stroke,strokeWidth:2,opacity:s.opacity,transform:`rotate(${s.rotation} ${s.x} ${s.y})`};
  if(s.kind==='ellipse')return React.createElement('ellipse',{...common,cx:s.x,cy:s.y,rx:s.width/2,ry:s.height/2});
  if(s.kind==='line')return React.createElement('line',{...common,x1:s.x,y1:s.y,x2:s.width,y2:s.height});
  return React.createElement('rect',{...common,x:s.x,y:s.y,width:s.width,height:s.height,rx:20});
 })));
}

