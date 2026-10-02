// Backend-only entitlement policy. A real endpoint must first verify the Supabase access token.
export function createSharedKeyGate({approvedEmails=[],perMinute=5,perUserDaily=30,globalDaily=100,allowAnyVerified=false}={}) {
 const approved=new Set(approvedEmails.map(e=>e.toLowerCase()));const usage=new Map();let day='',total=0;
 return function authorize(identity,prompt,now=Date.now()) {
  if(!identity?.verified || !identity.emailVerified || !identity.uid) throw new Error('Verified identity required');
  if(!allowAnyVerified && !approved.has(identity.email?.toLowerCase())) throw new Error('Owner approval required');
  if(typeof prompt!=='string'||prompt.length<1||prompt.length>500) throw new Error('Style request must be 1–500 characters');
  const today=new Date(now).toISOString().slice(0,10);if(day!==today){day=today;total=0;usage.clear()}
  const record=usage.get(identity.uid)||{daily:0,recent:[]};record.recent=record.recent.filter(t=>t>now-60000);
  if(record.recent.length>=perMinute||record.daily>=perUserDaily||total>=globalDaily) throw new Error('Shared usage limit reached');
  record.daily++;record.recent.push(now);total++;usage.set(identity.uid,record);
  return {maxOutputTokens:512,timeoutMs:10000,capability:'style-only'};
 }
}
