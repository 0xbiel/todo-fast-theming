import {themes,validateTheme,readableTheme} from './theme.js';
export const visualFixtures={
 notebook:validateTheme(readableTheme({...themes[1],name:'Notebook paper',background:'#faf8f0',surface:'#fffcf5',text:'#282828',muted:'#52544f',accent:'#385a80',urgentColor:'#963e39',radius:4,visual:{
  canvasCss:'background-color:#faf8f0;background-image:radial-gradient(#b8ab94 0.6px,transparent 0.7px);background-size:7px 7px;',
  cardCss:'background-color:#fffcf5;border-color:#dad0b9;border-style:solid;border-width:1px;border-radius:4px;box-shadow:0px 3px 8px rgba(73,55,29,0.10),0px 1px 2px rgba(73,55,29,0.08);',
  headingCss:'font-family:Georgia,serif;font-weight:600;letter-spacing:0px;',
  titleCss:'font-family:Georgia,serif;font-weight:500;letter-spacing:0px;',
  sceneSvg:'<svg viewBox="0 0 1000 1000"><defs><pattern id="rules" width="1000" height="38" patternUnits="userSpaceOnUse"><line x1="0" y1="37" x2="1000" y2="37" stroke="#abc3d6" stroke-width="1" opacity="0.46"/></pattern></defs><rect width="1000" height="1000" fill="url(#rules)"/><line x1="70" y1="0" x2="70" y2="1000" stroke="#d89891" stroke-width="1.4" opacity="0.6"/></svg>',
  cardSvg:'<svg viewBox="0 0 1000 1000"><path d="M 985 0 L 1000 15 L 1000 0 Z" fill="#e9dfc8"/><line x1="28" y1="0" x2="28" y2="1000" stroke="#e7a9a0" stroke-width="2" opacity="0.6"/></svg>'
 }})),
 leather:validateTheme(readableTheme({...themes[1],name:'Leather and notes',background:'#4d2f20',surface:'#fff0a8',text:'#31250c',muted:'#615227',accent:'#75542a',urgentColor:'#8c3023',radius:2,visual:{
  canvasCss:'background-color:#4d2f20;background-image:radial-gradient(rgba(0,0,0,0.22) 0.7px,transparent 1px),linear-gradient(135deg,#583824,#362014);background-size:4px 4px,100% 100%;',
  cardCss:'background-color:#fff0a8;background-image:linear-gradient(175deg,#fff6c5,#f5df83);border-color:#d7bd65;border-width:1px;border-style:solid;border-radius:2px;box-shadow:2px 6px 12px rgba(0,0,0,0.25);',
  headingCss:'font-family:Georgia,serif;font-weight:600;letter-spacing:1px;',
  titleCss:'font-family:Garamond,serif;font-weight:500;letter-spacing:0px;',
  sceneSvg:'<svg viewBox="0 0 1000 1000"><rect x="14" y="14" width="972" height="972" rx="12" fill="none" stroke="#ba9166" stroke-width="2" stroke-dasharray="5 6" opacity="0.65"/><rect x="22" y="22" width="956" height="956" rx="9" fill="none" stroke="#26160e" stroke-width="1" opacity="0.5"/></svg>',
  cardSvg:'<svg viewBox="0 0 1000 1000"><path d="M 880 1000 Q 970 960 1000 870 L 1000 1000 Z" fill="#d7b75f" opacity="0.5"/><rect x="330" y="0" width="340" height="50" fill="#f6e9ad" opacity="0.75"/></svg>'
 }}))
};
