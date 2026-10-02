import {resolve} from 'node:path';
import {createDurableLedger} from './ledger.js';
import {createCerebrasAdapter} from './style-service.js';
import {createLocalByokServer} from './local-byok.js';
// No configured owner key; the only key is supplied transiently by the user.
const ledger=createDurableLedger({path:resolve('server-data/local-byok.sqlite'),limits:{globalBudgetMicros:0,globalDaily:3,perUserDaily:3,perMinute:3,maxConcurrent:1}});
createLocalByokServer({ledger,generate:createCerebrasAdapter()}).listen(8787,'127.0.0.1',()=>console.info('Local BYOK API ready on loopback. No provider requests have been made.'));
