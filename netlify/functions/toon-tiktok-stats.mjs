import {getStore} from '@netlify/blobs';

const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, s-maxage=600','X-Content-Type-Options':'nosniff'};
const PROFILE='https://www.tiktok.com/@toon_clipz_?lang=en';
const CACHE_MS=15*60*1000;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const safeUrl=(value)=>{
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&(url.hostname==='tiktok.com'||url.hostname.endsWith('.tiktok.com'))?url.href:PROFILE;
  }catch{return PROFILE;}
};
const validCount=(n)=>Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):0;
export function summarizeVideos(videos,now=Date.now()){
  const posts=videos.slice(0,20).map(video=>({
    id:String(video.id||''),
    title:String(video.title||video.video_description||'ToonClipz post').slice(0,120),
    views:validCount(video.view_count),
    likes:validCount(video.like_count),
    url:safeUrl(video.share_url),
    postedAt:Number(video.create_time||0)
  }));
  return {status:'live',sampleSize:posts.length,totalViews:posts.reduce((sum,p)=>sum+p.views,0),totalLikes:posts.reduce((sum,p)=>sum+p.likes,0),posts,updatedAt:new Date(now).toISOString(),profileUrl:PROFILE};
}
async function refreshToken(store,env,request=fetch,now=Date.now()){
  const saved=await store.get('oauth',{type:'json',consistency:'strong'});
  if(saved?.access_token&&saved.expires_at>now+60000)return saved.access_token;
  const refresh=saved?.refresh_token||env.TIKTOK_REFRESH_TOKEN;
  if(!refresh||!env.TIKTOK_CLIENT_KEY||!env.TIKTOK_CLIENT_SECRET)throw new Error('TikTok authorization missing');
  const body=new URLSearchParams({client_key:env.TIKTOK_CLIENT_KEY,client_secret:env.TIKTOK_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:refresh});
  const response=await request('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('TikTok token refresh unavailable');
  const data=await response.json();
  if(!data.access_token||!data.refresh_token||!String(data.scope||'').split(',').includes('video.list'))throw new Error('TikTok video permission unavailable');
  await store.setJSON('oauth',{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:now+validCount(data.expires_in)*1000});
  return data.access_token;
}
export async function handler(request,{env=process.env}={}){
  if(request.method!=='GET')return json(405,{status:'unavailable'});
  if(!env.TIKTOK_REFRESH_TOKEN||!env.TIKTOK_CLIENT_KEY||!env.TIKTOK_CLIENT_SECRET)return json(503,{status:'not_connected',profileUrl:PROFILE});
  try{
    const store=getStore('toonclipz-tiktok-stats');
    const cached=await store.get('recent-posts',{type:'json',consistency:'strong'});
    if(cached?.updatedAt&&Date.now()-Date.parse(cached.updatedAt)<CACHE_MS)return json(200,cached);
    const token=await refreshToken(store,env);
    const url='https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,share_url,view_count,like_count';
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({max_count:20}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('TikTok video list unavailable');
    const data=await response.json();
    if(data.error?.code!=='ok'||!Array.isArray(data.data?.videos))throw new Error('TikTok video list unavailable');
    const result=summarizeVideos(data.data.videos);
    await store.setJSON('recent-posts',result);
    return json(200,result);
  }catch{
    return json(503,{status:'unavailable',profileUrl:PROFILE});
  }
}
export default handler;
