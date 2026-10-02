import test from 'node:test';import assert from 'node:assert/strict';
import {loadStoredTheme,saveStoredTheme,themeStorageKey} from '../src/theme-storage.js';import {themes,validateTheme} from '../src/theme.js';import {visualFixtures} from '../src/visual-fixture-data.js';
const memory=()=>{const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
test('validated generated designs and local presets survive a storage round trip',()=>{
 const storage=memory();for(const theme of [...themes,...Object.values(visualFixtures)]){saveStoredTheme(storage,theme);assert.deepEqual(loadStoredTheme(storage,themes[0]),validateTheme(theme))}
 assert.deepEqual([...storage.values.keys()],[themeStorageKey]);
});
test('corrupt, oversized, unsupported and unsafe stored designs safely fall back without rewriting storage',()=>{
 for(const raw of ['{broken','null','[]','{}',JSON.stringify({version:2,theme:themes[1]}),JSON.stringify({version:1,theme:themes[1],secret:'extra'}),JSON.stringify({version:1,theme:{...themes[1],script:'evil'}}),JSON.stringify({version:1,theme:{...visualFixtures.notebook,visual:{...visualFixtures.notebook.visual,canvasCss:'background-image:url(https://evil.example)'}}}),'x'.repeat(131073)]){
  const storage=memory();storage.setItem(themeStorageKey,raw);assert.equal(loadStoredTheme(storage,themes[0]),themes[0]);assert.equal(storage.getItem(themeStorageKey),raw);
 }
});
test('theme writes never touch tasks, keys or authentication and reject unvalidated extras',()=>{
 const storage=memory();storage.setItem('board-studio.tasks','private tasks');storage.setItem('board-studio.byok','private key');storage.setItem('auth-session','private auth');
 saveStoredTheme(storage,visualFixtures.notebook);const previous=storage.getItem(themeStorageKey);
 for(const field of ['tasks','apiKey','token'])assert.throws(()=>saveStoredTheme(storage,{...themes[0],[field]:'private value'}));
 assert.equal(storage.getItem(themeStorageKey),previous);assert.equal(storage.getItem('board-studio.tasks'),'private tasks');assert.equal(storage.getItem('board-studio.byok'),'private key');assert.equal(storage.getItem('auth-session'),'private auth');assert.doesNotMatch(previous,/private/);
});
test('saving an Undo result replaces only the saved design and storage failures are reported',()=>{
 const storage=memory();saveStoredTheme(storage,visualFixtures.notebook);saveStoredTheme(storage,visualFixtures.leather);saveStoredTheme(storage,visualFixtures.notebook);assert.deepEqual(loadStoredTheme(storage,themes[0]),visualFixtures.notebook);
 const unavailable={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(loadStoredTheme(unavailable,themes[0]),themes[0]);assert.throws(()=>saveStoredTheme(unavailable,themes[1]));
});
