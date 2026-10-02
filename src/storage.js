export const initialTasks = [
{id:'1', title:'Map the product experience', status:'todo', label:'Design'},
{id:'2', title:'Explore a new visual direction', status:'todo', label:'Creative'},
{id:'3', title:'Build the trusted task controls', status:'progress', label:'Engineering'},
{id:'4', title:'Keep data across every redesign', status:'progress', label:'Engineering'},
{id:'5', title:'Define the first milestone', status:'done', label:'Planning'}
];
export function parseTasks(raw) {
 try { const value=JSON.parse(raw); if (!Array.isArray(value) || value.length > 500 || !value.every(t => t && typeof t.id==='string' && typeof t.title==='string' && t.title.length<=200 && ['todo','progress','done'].includes(t.status))) return initialTasks; return value.map(t=>({id:t.id,title:t.title,status:t.status,label:typeof t.label==='string'?t.label.slice(0,40):'Task',description:typeof t.description==='string'?t.description.slice(0,2000):'',priority:['Low','Medium','High','Urgent'].includes(t.priority)?t.priority:'Medium'})); } catch { return initialTasks; }
}
