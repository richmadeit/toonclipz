import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

export const EVENTS = Object.freeze({page_view:'Page viewed',get_started:'Get started clicked',form_start:'Form started',photos_ready:'3–5 photos added',song_ready:'Song selected',clip_selected:'Song section selected',details_saved:'Order details saved',checkout:'Checkout opened',form_error:'Upload failed',video_play:'Example played'});
const SOURCES = ['instagram','facebook','tiktok','google','direct','other'];
export const json=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function sameOrigin(req){return req.headers.get('origin')===new URL(req.url).origin;}
export function secret(env){return typeof env.TOONCLIPZ_DASHBOARD_PASSWORD==='string' && env.TOONCLIPZ_DASHBOARD_PASSWORD.length>=16 ? env.TOONCLIPZ_DASHBOARD_PASSWORD : null;}
const hash=s=>createHash('sha256').update(String(s)).digest();
export function equal(a,b){return timingSafeEqual(hash(a),hash(b));}
const signature=(text,key)=>createHmac('sha256',key).update('toonclipz-dashboard:'+text).digest('hex');
export function cookie(key,now=Date.now(),clear=false){const exp=String(now+12*3600000);return `__Host-toonclipz-dashboard=${clear?'':exp+'.'+signature(exp,key)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${clear?0:43200}`;}
export function authorized(req,key,now=Date.now()){
  if(!key)return false;
  const token=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-toonclipz-dashboard='))?.split('=')[1]||'';
  const [exp,sig]=token.split('.');
  return /^\d{13}$/.test(exp||'')&&Number(exp)>now&&Number(exp)<=now+43200000&&equal(sig||'',signature(exp,key));
}
export function cleanEvent(input,now=Date.now()){
  if(!input || !Object.hasOwn(EVENTS,input.type) || !/^[a-f0-9-]{36}$/.test(input.session||'') || !/^[a-f0-9-]{36}$/.test(input.id||''))return null;
  return {id:input.id,session:input.session,type:input.type,at:now,source:SOURCES.includes(input.source)?input.source:'other',device:['mobile','desktop','tablet'].includes(input.device)?input.device:'desktop'};
}
export async function record(store,event){
  const key='sessions/'+new Date(event.at).toISOString().slice(0,10)+'/'+event.session;
  for(let n=0;n<4;n++){
    const old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
    const row=old?.data||{session:event.session,source:event.source,device:event.device,firstSeen:event.at,events:[]};
    if(row.events.some(e=>e.id===event.id)||row.events.length>=60)return;
    row.events.push({id:event.id,type:event.type,at:event.at});row.lastSeen=event.at;
    const result=await store.setJSON(key,row,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(result.modified)return;
  }
  throw new Error('Concurrent update');
}
export function summarize(rows,since,now=Date.now()){
  const sessionSets=Object.fromEntries(Object.keys(EVENTS).map(k=>[k,new Set()]));
  const sessions=new Set(),recent=new Set(),sources={},timeline=[],hours=Array.from({length:24},(_,i)=>({at:Math.floor(now/3600000)*3600000-(23-i)*3600000,views:0}));
  let pageViews=0;
  for(const row of rows){
    const es=row.events.filter(e=>e.at>=since&&e.at<=now);
    if(!es.length)continue;
    sessions.add(row.session);
    if(es.some(e=>e.at>=now-300000))recent.add(row.session);
    (sources[row.source]??=new Set()).add(row.session);
    for(const e of es){
      sessionSets[e.type]?.add(row.session);
      if(e.type==='page_view'){pageViews++;const h=hours.find(h=>h.at===Math.floor(e.at/3600000)*3600000);if(h)h.views++;}
      timeline.push({type:e.type,at:e.at,source:row.source,device:row.device});
    }
  }
  return {sessions:sessions.size,recent:recent.size,pageViews,steps:Object.fromEntries(Object.entries(sessionSets).map(([k,v])=>[k,v.size])),sources:Object.entries(sources).map(([name,s])=>({name,sessions:s.size})).sort((a,b)=>b.sessions-a.sessions),timeline:timeline.sort((a,b)=>b.at-a.at).slice(0,40),hours};
}
export async function readTraffic(store,since,now=Date.now()){
  const keys=[];let truncated=false;
  for(let day=Math.floor(since/86400000)*86400000;day<=now;day+=86400000){
    const prefix='sessions/'+new Date(day).toISOString().slice(0,10)+'/';
    for await(const page of store.list({prefix,paginate:true})){
      for(const b of page.blobs){if(keys.length>=2000){truncated=true;break;}keys.push(b.key);}
      if(truncated)break;
    }
    if(truncated)break;
  }
  const rows=[];
  for(let i=0;i<keys.length;i+=25){rows.push(...await Promise.all(keys.slice(i,i+25).map(k=>store.get(k,{type:'json',consistency:'strong'}))));}
  return {...summarize(rows.filter(Boolean),since,now),truncated};
}
export async function readPurchases(env,since,fetcher=fetch,brand='toonclipz'){
  const key=env.STRIPE_SECRET_KEY,allowed=(env.STRIPE_PAYMENT_LINK_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!key)return {available:false,reason:'Live Stripe verification is not configured.'};
  let after;const payments=[];let truncated=false;
  for(let page=0;page<5;page++){
    const url=new URL('https://api.stripe.com/v1/checkout/sessions');
    url.searchParams.set('limit','100');url.searchParams.set('created[gte]',String(Math.floor(since/1000)));
    url.searchParams.append('expand[]','data.payment_intent.latest_charge');url.searchParams.append('expand[]','data.payment_link');if(after)url.searchParams.set('starting_after',after);
    const res=await fetcher(url,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw new Error('Stripe unavailable');
    const data=await res.json();
    for(const s of data.data){
      const linkId=typeof s.payment_link==='string'?s.payment_link:s.payment_link?.id;
      const currentOffer=s.payment_link?.url==='https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04';
      const belongs=brand==='richmadeit'
        ? s.payment_link?.url==='https://buy.stripe.com/dRm6oI4wB0yHaA7crx2wU03' && s.amount_subtotal===5000
        : (currentOffer && s.amount_subtotal===6000) || (allowed.includes(linkId) && s.amount_subtotal===2500);
      if(!s.livemode||s.mode!=='payment'||s.status!=='complete'||s.payment_status!=='paid'||!belongs||s.currency!=='usd')continue;
      const charge=s.payment_intent?.latest_charge;
      // A missing expansion cannot safely be reported as zero refunds.
      if(!charge||typeof charge!=='object')throw new Error('Stripe charge details unavailable');
      payments.push({at:s.created*1000,amount:s.amount_total,refunded:charge.amount_refunded||0});
    }
    if(!data.has_more)break;
    if(page===4){truncated=true;break;}after=data.data.at(-1)?.id;if(!after)throw new Error('Invalid Stripe pagination');
  }
  return {available:true,count:payments.filter(p=>p.refunded<p.amount).length,gross:payments.reduce((n,p)=>n+p.amount,0),refunds:payments.reduce((n,p)=>n+p.refunded,0),truncated};
}
