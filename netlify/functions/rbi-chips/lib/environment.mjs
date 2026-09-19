// Read only this feature's environment variables. Never inherit another site's keys.
export const ENV_NAMES=Object.freeze([
  'SITE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
  'ADMIN_USER_IDS','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY'
]);
export function readRbiEnv(source=process.env){
  return Object.fromEntries(ENV_NAMES.map(name=>[name,String(source['RBI_'+name]||'').trim()]));
}
