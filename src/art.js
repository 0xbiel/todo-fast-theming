import React from 'react';
const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function validateArt(art,background){
 if(art===undefined)return {angle:135,start:background,end:background,shapes:[]};
 if(!art||Array.isArray(art)||Object.keys(art).some(k=>!['angle','start','end','shapes'].includes(k))||!Number.isInteger(art.angle)||art.angle<0||art.angle>360||!hex(art.start)||!hex(art.end)||!Array.isArray(art.shapes)||art.shapes.length>8)throw Error('Invalid background art');
 const keys=['kind','x','y','width','height','rotation','fill','stroke','opacity'];
 const shapes=art.shapes.map(shape=>{
  if(!shape||Object.keys(shape).length!==keys.length||Object.keys(shape).some(k=>!keys.includes(k))||!['ellipse','rect','line'].includes(shape.kind)||!hex(shape.fill)||!hex(shape.stroke))throw Error('Invalid decorative shape');
  for(const k of ['x','y','width','height','rotation','opacity'])if(typeof shape[k]!=='number'||!Number.isFinite(shape[k]))throw Error('Invalid geometry');
  if(shape.x<0||shape.x>1000||shape.y<0||shape.y>1000||shape.width<0||shape.width>1000||shape.height<0||shape.height>1000||shape.rotation<0||shape.rotation>360||shape.opacity<0||shape.opacity>.3)throw Error('Decoration out of bounds');
  return {...shape};
 });return {angle:art.angle,start:art.start,end:art.end,shapes};
}
// Trusted renderer: no raw SVG markup, URL references, events or foreignObject.
export function BackgroundArt({art}){
 return React.createElement('svg',{'aria-hidden':true,className:'background-art',viewBox:'0 0 1000 1000',preserveAspectRatio:'none'},art.shapes.map((s,i)=>{
  const common={key:i,fill:s.fill,stroke:s.stroke,strokeWidth:2,opacity:s.opacity,transform:`rotate(${s.rotation} ${s.x} ${s.y})`};
  if(s.kind==='ellipse')return React.createElement('ellipse',{...common,cx:s.x,cy:s.y,rx:s.width/2,ry:s.height/2});
  if(s.kind==='line')return React.createElement('line',{...common,x1:s.x,y1:s.y,x2:s.width,y2:s.height});
  return React.createElement('rect',{...common,x:s.x,y:s.y,width:s.width,height:s.height,rx:20});
 }));
}
