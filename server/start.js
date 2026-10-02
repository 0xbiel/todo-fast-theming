import {createClient} from '@supabase/supabase-js';
import {createLiveServer} from './live.js';
const env=process.env;
const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN','QUOTA_DB_PATH','DAILY_BUDGET_MICROS','INPUT_MICROS_PER_MILLION','OUTPUT_MICROS_PER_MILLION'];
if(required.some(name=>!env[name]))throw Error('Server configuration incomplete; see .env.example');
const supabaseClient=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const server=createLiveServer({supabaseClient,origin:env.APP_ORIGIN,allowLocalDevelopment:env.ALLOW_LOCAL_DEVELOPMENT==='true',databasePath:env.QUOTA_DB_PATH,ownerKey:env.CEREBRAS_API_KEY,approvedEmails:(env.APPROVED_EMAILS||'').split(',').filter(Boolean),limits:{globalBudgetMicros:Number(env.DAILY_BUDGET_MICROS),globalDaily:Number(env.GLOBAL_DAILY_REQUESTS||100)},rates:{inputMicrosPerMillion:Number(env.INPUT_MICROS_PER_MILLION),outputMicrosPerMillion:Number(env.OUTPUT_MICROS_PER_MILLION)}});
server.listen(Number(env.API_PORT||8787),'127.0.0.1',()=>console.info('Board API listening on loopback.'));
