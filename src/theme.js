export const themes = [
{ name: 'Midnight', background: '#101116', surface: '#191b23', text: '#f0f1f5', muted: '#9699ac', accent: '#a799ff', radius: 12, font: 'sans', density: 'comfortable', layout: 'columns' },
{ name: 'Paper', background: '#eeeae1', surface: '#faf8f2', text: '#252b28', muted: '#70756e', accent: '#477b61', radius: 6, font: 'serif', density: 'comfortable', layout: 'columns' },
{ name: 'Ocean', background: '#081f2b', surface: '#103241', text: '#e6f8fc', muted: '#85adbb', accent: '#6fdad0', radius: 20, font: 'sans', density: 'compact', layout: 'stacked' },
{ name: 'Rose', background: '#261b25', surface: '#382634', text: '#fff0f6', muted: '#bd9cac', accent: '#f4a5c1', radius: 16, font: 'sans', density: 'comfortable', layout: 'columns' }
];
export function validateTheme(input) {
 const keys = ['name','background','surface','text','muted','accent','radius','font','density','layout'];
 if (!input || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k))) throw new Error('Unsupported presentation field');
 for (const key of ['background','surface','text','muted','accent']) if (!/^#[0-9a-f]{6}$/i.test(input[key])) throw new Error('Invalid color');
 if (typeof input.name !== 'string' || input.name.length > 40 || !Number.isInteger(input.radius) || input.radius < 0 || input.radius > 24 || !['sans','serif'].includes(input.font) || !['compact','comfortable'].includes(input.density)) throw new Error('Invalid theme');
 if (!['columns','stacked'].includes(input.layout)) throw new Error('Invalid layout');
 return Object.fromEntries(keys.map(k => [k,input[k]]));
}
export async function generateMockTheme(prompt, current) {
 validateStyleRequest(prompt);
 await new Promise(resolve => setTimeout(resolve, 600));
 const match = /paper|light|editorial/i.test(prompt) ? themes[1] : /ocean|blue|teal/i.test(prompt) ? themes[2] : /pink|rose/i.test(prompt) ? themes[3] : themes[(themes.findIndex(t => t.name === current.name) + 1) % themes.length];
 return validateTheme({...match,layout:/stack/i.test(prompt)?'stacked':match.layout});
}

export function validateStyleRequest(prompt) {
 if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 500 || /[?]|ignore|instructions|javascript|html|api.?key|secret|delete|add task|move task|explain|calculate|who is|what is|write (a|an)|weather/i.test(prompt) || !/random|paper|light|dark|editorial|ocean|blue|teal|pink|rose|minimal|calm|color|colour|style|look|layout|compact|serif|modern|midnight|warm|cool|green|purple|rounded|stack/i.test(prompt)) throw new Error('Describe only a visual style, for example calm ocean or editorial paper.');
 return prompt.trim();
}
