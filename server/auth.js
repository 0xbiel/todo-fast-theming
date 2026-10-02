// Server-scoped Supabase client: persistSession:false, autoRefreshToken:false.
// getUser(jwt) verifies against the configured project's Auth server; never trust
// getSession() or browser-provided user metadata for server authorization.
export function supabaseVerifier(client) {
 return async token=>{
  if(typeof token!=='string'||!token||token.length>8192)throw Error('Unauthorized');
  const {data,error}=await client.auth.getUser(token);
  const user=data?.user;
  if(error||typeof user?.id!=='string'||!user.id||!user.email_confirmed_at||typeof user.email!=='string')throw Error('Unauthorized');
  return {uid:user.id,email:user.email,email_verified:true};
 };
}
