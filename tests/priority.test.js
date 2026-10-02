import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Priority,priorities} from '../src/priority.js';
import {createLiveServer} from '../server/live.js';
test('priority bars carry level labels and rising heights',()=>{
 priorities.forEach((value,i)=>{
  const html=renderToStaticMarkup(React.createElement(Priority,{value}));
  assert.equal((html.match(/signal-bar filled/g)||[]).length,i+1);
  assert.match(html,new RegExp(`${value}</span>`));
  assert.match(html,new RegExp(`priority, ${i+1} of 4`));
  assert.deepEqual([...html.matchAll(/height:(\d+)px/g)].map(m=>Number(m[1])),[4,7,10,13]);
 });
});
test('live composition imports safely and rejects absent budget before opening a server',()=>{
 assert.throws(()=>createLiveServer({origin:'https://example.com'}),/budget/);
 assert.throws(()=>createLiveServer({origin:'http://example.com',limits:{globalBudgetMicros:1}}),/HTTPS/);
});
