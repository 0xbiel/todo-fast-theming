import React from 'react';
export const priorities=['Low','Medium','High','Urgent'];
export function Priority({value='Medium'}) {
 const priority=priorities.includes(value)?value:'Medium';
 const level=priorities.indexOf(priority)+1;
 return React.createElement('span',{className:'priority-indicator '+priority.toLowerCase(),'data-level':level},
  React.createElement('span',{className:'priority-signal','aria-hidden':true},...priorities.map((_,i)=>React.createElement('span',{key:i,className:i<level?'signal-bar filled':'signal-bar',style:{height:(4+i*3)+'px'}}))),
  React.createElement('span',null,priority),
  React.createElement('span',{className:'sr-only'},` priority, ${level} of 4`));
}
