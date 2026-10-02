import {makeSnapshot} from '../src/capabilities.js';
import {initialTasks} from '../src/storage.js';
const validId=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id);
export function createSnapshotService({verifyIdToken,store}) {
 async function owner(token){const claims=await verifyIdToken(token);if(!claims?.uid||claims.email_verified!==true)throw Error('Unauthorized');return claims.uid}
 return {
  async publish({token,theme,id}){
   const uid=await owner(token);if(id!==undefined&&!validId(id))throw Error('Invalid ID');
   // Only trusted example tasks. Callers cannot choose arbitrary task data.
   return store.publishSnapshot({id,owner:uid,payload:makeSnapshot(initialTasks,theme)});
  },
  async read(id){if(!validId(id))return null;const result=await store.readSnapshot(id);return result.snapshot?makeSnapshot(result.snapshot.tasks,result.snapshot.theme):null},
  async revoke({token,id}){if(!validId(id))throw Error('Invalid ID');return store.revokeSnapshot({id,owner:await owner(token)})}
 };
}
