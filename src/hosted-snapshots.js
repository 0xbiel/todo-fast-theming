import {makeSnapshot} from './capabilities.js';
export function createHostedSnapshotClient(getToken,fetchImpl=fetch){
 const valid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id);
 async function ownerRequest(method,id,theme){
  if(id&&!valid(id))throw Error('Invalid snapshot');
  const token=await getToken?.();if(!token)throw Error('Sign in to publish an example snapshot.');
  const response=await fetchImpl('/api/snapshots'+(id?'/'+id:''),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:theme?JSON.stringify({theme}):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Snapshot unavailable.');return response.json();
 }
 return {
  async read(id){if(!valid(id))return null;const res=await fetchImpl('/api/snapshots/'+id,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!res.ok)return null;const {snapshot}=await res.json();return snapshot?makeSnapshot(snapshot.tasks,snapshot.theme):null},
  publish:(theme,id)=>ownerRequest(id?'PUT':'POST',id,theme),
  revoke:id=>ownerRequest('DELETE',id)
 };
}
