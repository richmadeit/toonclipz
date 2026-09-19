import crypto from 'node:crypto';
import {AppError,assert} from './domain.mjs';
export function makeAuth(env,fetcher=fetch){
  const authURL=()=>`${(env.SUPABASE_URL||'').replace(/\/$/,'')}/auth/v1`;
  const ids=()=>String(env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const cookieName=()=>env.SITE_URL?.startsWith('https://')?'__Host-rbi_chips_admin':'rbi_chips_local_admin';
  async function call(path,options={}){
    assert(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY&&ids().length,'Admin authentication has not been configured.',503);
    let r;try{r=await fetcher(authURL()+path,{...options,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});}catch{throw new AppError(503,'Sign-in service is unavailable.');}
    if(!r.ok)throw new AppError(401,'Sign-in failed or expired. Please sign in again.');return r.json();
  }
  function cookie(token,age=3300){const secure=env.SITE_URL?.startsWith('https://');return `${cookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;}
  function getToken(req){const pair=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName()+'='));if(!pair)return '';try{return decodeURIComponent(pair.slice(cookieName().length+1));}catch{return '';}}
  return {
    async login(email,password){
      assert(typeof email==='string'&&email.length<=254&&typeof password==='string'&&password.length<=500,'Check your email and password.');
      const result=await call('/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
      assert(result.user&&ids().includes(result.user.id),'This account does not have admin access.',403);
      return {user:{id:result.user.id,email:result.user.email},cookie:cookie(result.access_token,Math.max(60,Math.min(result.expires_in||3600,3600)-60))};
    },
    async verify(req){const token=getToken(req);assert(token,'Please sign in.',401);const user=await call('/user',{headers:{Authorization:`Bearer ${token}`}});assert(ids().includes(user.id),'Admin access is not allowed.',403);return {id:user.id,email:user.email};},
    async logout(req){const token=getToken(req);if(token){try{await fetcher(authURL()+'/logout',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});}catch{}}
      return cookie('',0);
    }
  };
}
export function rateBucket(env,ip,path){return crypto.createHmac('sha256',env.SUPABASE_SECRET_KEY||'test-only').update(`${ip}:${path}`).digest('hex');}
