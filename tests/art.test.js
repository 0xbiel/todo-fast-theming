import test from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {validateTheme,themes} from '../src/theme.js';import {BackgroundArt} from '../src/art.js';
const shape={kind:'ellipse',x:220,y:140,width:480,height:300,rotation:35,fill:'#d2aaff',stroke:'#aaffdd',opacity:.15};
test('custom gradients and SVG geometry are accepted through trusted renderer',()=>{
 const theme=validateTheme({...themes[0],urgentColor:'#99eecc',art:{angle:25,start:'#081b25',end:'#261533',shapes:[shape]}});
 const html=renderToStaticMarkup(React.createElement(BackgroundArt,{art:theme.art}));
 assert.match(html,/<ellipse/);assert.match(html,/aria-hidden="true"/);assert.match(html,/rotate\(35 220 140\)/);assert.equal(theme.urgentColor,'#99eecc');
});
test('untrusted SVG, URLs, excess geometry and unreadable urgency are rejected',()=>{
 for(const changes of [{kind:'script'},{kind:'foreignObject'},{fill:'url(https://evil.example)'},{onload:'alert(1)'},{href:'https://evil.example'},{opacity:1},{x:Infinity}])assert.throws(()=>validateTheme({...themes[0],art:{angle:10,start:'#101116',end:'#111111',shapes:[{...shape,...changes}]}}));
 assert.throws(()=>validateTheme({...themes[0],urgentColor:themes[0].surface}));
 assert.throws(()=>validateTheme({...themes[0],art:{angle:10,start:'#101116',end:'#111111',shapes:Array(9).fill(shape)}}));
});
