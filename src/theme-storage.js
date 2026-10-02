import {validateTheme} from './theme.js';
export const themeStorageKey='board-studio.theme.v1';
const maxStoredLength=131072;
export function loadStoredTheme(storage,fallback){
 try{
  const raw=storage.getItem(themeStorageKey);if(typeof raw!=='string'||raw.length>maxStoredLength)return fallback;
  const saved=JSON.parse(raw);
  if(!saved||Array.isArray(saved)||saved.version!==1||Object.keys(saved).length!==2||!Object.hasOwn(saved,'theme'))return fallback;
  return validateTheme(saved.theme);
 }catch{return fallback}
}
export function saveStoredTheme(storage,theme){
 const raw=JSON.stringify({version:1,theme:validateTheme(theme)});
 if(raw.length>maxStoredLength)throw Error('Design storage unavailable');
 storage.setItem(themeStorageKey,raw);
}
