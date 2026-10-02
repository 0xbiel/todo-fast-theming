import {supabaseVerifier} from './auth.js';
import {createDurableLedger} from './ledger.js';
import {createStyleService,createCerebrasAdapter} from './style-service.js';
import {createSnapshotService} from './snapshots.js';
import {createApiServer} from './http.js';
// Composition only; importing this file never contacts a provider or opens a port.
// Host supplies server Supabase client and reviewed limits/rates from trusted config.
export function createLiveServer({supabaseClient,origin,databasePath,ownerKey,approvedEmails,limits,rates,allowLocalDevelopment=false}) {
 if(!origin.startsWith('https://')&&!(allowLocalDevelopment&&['http://127.0.0.1:5173','http://localhost:5173'].includes(origin)))throw Error('HTTPS origin required');
 if(!limits||!Number.isSafeInteger(limits.globalBudgetMicros)||limits.globalBudgetMicros<=0)throw Error('Explicit daily owner budget required');
 const ledger=createDurableLedger({path:databasePath,limits});
 const service=createStyleService({verifyIdToken:supabaseVerifier(supabaseClient),generate:createCerebrasAdapter(),ownerKey,approvedEmails,ledger,rates});
 const snapshots=createSnapshotService({verifyIdToken:supabaseVerifier(supabaseClient),store:ledger});
 return createApiServer({service,snapshots,origin});
}
