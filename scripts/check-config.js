// Run with node --env-file=.env.local. Presence checks only; no secret values.
const names=['SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY','CEREBRAS_API_KEY','APPROVED_EMAILS','QUOTA_DB_PATH','DAILY_BUDGET_MICROS','INPUT_MICROS_PER_MILLION','OUTPUT_MICROS_PER_MILLION'];
let complete=true;
for(const name of names){const present=!!process.env[name]?.trim();complete&&=present;console.info(`${name}: ${present?'set':'missing'}`)}
const forbidden=Object.keys(process.env).some(name=>name.startsWith('VITE_')&&/CEREBRAS|SERVICE_ROLE|SECRET|PRIVATE_KEY/i.test(name)&&process.env[name]);
if(forbidden){console.info('Unsafe public secret variable detected. Remove it before activation.');process.exitCode=1}
else if(!complete)process.exitCode=2;
else console.info('Required settings present. Values were not displayed.');
