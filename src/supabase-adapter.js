// Inject @supabase/supabase-js client configured for PKCE after project approval.
// No task data or API keys are sent to Supabase by this adapter.
export function createSupabaseAdapter(client,redirectTo) {
 async function checked(promise){const result=await promise;if(result.error)throw Error('Authentication unavailable');return result.data}
 return {
  google:()=>checked(client.auth.signInWithOAuth({provider:'google',options:{redirectTo}})),
  github:()=>checked(client.auth.signInWithOAuth({provider:'github',options:{redirectTo}})),
  sendEmailLink:email=>checked(client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}})),
  verifyEmailCode:(email,token)=>checked(client.auth.verifyOtp({email,token,type:'email'})),
  exchangeCode:code=>checked(client.auth.exchangeCodeForSession(code)),
  signOut:()=>checked(client.auth.signOut()),
  subscribe:callback=>client.auth.onAuthStateChange((event,session)=>callback(session?.user??null,event)).data.subscription,
  sessionUser:async()=>{const data=await checked(client.auth.getSession());return data.session?.user??null},
  refresh:async()=>{const data=await checked(client.auth.refreshSession());if(!data.session)throw Error('Sign in required');return data.session.user},
  token:async()=>{const data=await checked(client.auth.getSession());if(!data.session?.access_token)throw Error('Sign in required');return data.session.access_token}
 };
}
