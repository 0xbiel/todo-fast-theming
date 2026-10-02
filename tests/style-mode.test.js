import test from 'node:test';import assert from 'node:assert/strict';import {createStyleDispatcher} from '../src/style-mode.js';
test('unconfigured production never generates pretend provider output',()=>{
 let calls=0;const generate=createStyleDispatcher({localByokEnabled:false,liveAI:false,mockEnabled:false,local:()=>calls++,live:()=>calls++,mock:()=>calls++});
 assert.throws(()=>generate('rose gradient',{}),/Cerebras setup required/);assert.equal(calls,0);
});
test('only explicitly selected local, live or development mock routes execute',()=>{
 for(const [flag,route] of [['localByokEnabled','local'],['liveAI','live'],['mockEnabled','mock']]){let called;const generate=createStyleDispatcher({[flag]:true,local:()=>called='local',live:()=>called='live',mock:()=>called='mock'});generate('style',{});assert.equal(called,route)}
});
