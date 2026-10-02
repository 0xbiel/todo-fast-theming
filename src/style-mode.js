export function createStyleDispatcher({localByokEnabled,liveAI,mockEnabled,local,live,mock}){
 return (prompt,current,options)=>{
  if(localByokEnabled)return local(prompt,current,options);
  if(liveAI)return live(prompt,current,options);
  if(mockEnabled)return mock(prompt,current);
  throw Error('Cerebras setup required. Sign-in and hosted AI must be configured before Restyle.');
 };
}

