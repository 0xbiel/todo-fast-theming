export function createStyleDispatcher({localByokEnabled,liveAI,mockEnabled,local,live,mock}){
 return (prompt,current)=>{
  if(localByokEnabled)return local(prompt,current);
  if(liveAI)return live(prompt,current);
  if(mockEnabled)return mock(prompt,current);
  throw Error('Cerebras setup required. Sign-in and hosted AI must be configured before Restyle.');
 };
}
