import {createHash} from 'node:crypto';

export const SITE_ORIGIN='https://toonclipz.netlify.app';
export const DEPOSIT_LINK='https://buy.stripe.com/eVqdRabZ33KTdMjfDJ2wU0b';
export const STORE_NAME='toonclipz-deposit-orders';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REF=new RegExp('^TC-D(30|60|180)-('+UUID+')$');
const SONG_HOSTS=new Set(['youtube.com','www.youtube.com','music.youtube.com','youtu.be','soundcloud.com','www.soundcloud.com','on.soundcloud.com','open.spotify.com','music.apple.com','audiomack.com','www.audiomack.com','drive.google.com','www.dropbox.com','dropbox.com']);
const CONTROL=/[\u0000-\u001f\u007f]/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function productionStore(){
  const {getStore}=await import('@netlify/blobs');
  return getStore({name:STORE_NAME,consistency:'strong'});
}
export function validateOrder(body){
  const fields=['ref','artist_name','email','contact','photo_paths','song_path','song_url','start_time','end_time','style','visual_style'];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k)))return {error:'request'};
  const match=typeof body.ref==='string'&&REF.exec(body.ref);
  if(!match)return {error:'ref'};
  const value={ref:body.ref};
  const limits={artist_name:120,email:254,contact:4000,song_path:300,song_url:2048,start_time:16,end_time:16};
  for(const [field,limit] of Object.entries(limits)){
    const raw=body[field]??'';
    if(typeof raw!=='string'||raw.length>limit||CONTROL.test(raw))return {error:field};
    value[field]=raw.trim();
  }
  value.email=value.email.toLowerCase();
  if(!/^[^\s@<>|]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(value.email)||value.email.includes('..'))return {error:'email'};
  if(body.style!=='realistic')return {error:'style'};
  value.style='realistic';
  const visualStyle=body.visual_style??'';
  if(!['gta-cinematic','gta-female','red-room','pink-stage','beach','concert-stage','characters','custom',''].includes(visualStyle))return {error:'visual_style'};
  value.visual_style=visualStyle;
  if(!Array.isArray(body.photo_paths)||body.photo_paths.length>5)return {error:'photo_paths'};
  // Matches the existing private-bucket uploader. No arbitrary URLs, traversal,
  // encoded separators or other orders' paths can be recorded through this API.
  const path=(raw,kind,extensions)=>typeof raw==='string'&&raw.length<=300&&new RegExp('^'+value.ref+'/'+UUID+'/'+kind+'-'+UUID+'\\.('+extensions+')$').test(raw);
  if(body.photo_paths.some(p=>!path(p,'photo','jpg|jpeg|png|webp'))||new Set(body.photo_paths).size!==body.photo_paths.length)return {error:'photo_paths'};
  value.photo_paths=[...body.photo_paths];
  if(!value.photo_paths.length&&value.visual_style!=='characters')return {error:'photo_required_or_choose_animal'};
  if(value.song_path&&!path(value.song_path,'song','mp3|m4a|wav|aac|aiff|aif|flac|mp4|mov|m4v|ogg|oga|opus|webm'))return {error:'song_path'};
  if(value.song_url){
    try{
      const u=new URL(value.song_url);
      if(u.protocol!=='https:'||u.username||u.password||u.port||!SONG_HOSTS.has(u.hostname)||u.pathname==='/'||/\s|\\/.test(value.song_url))return {error:'song_url'};
      // Text for manual review only: never fetch, embed or follow this URL.
    }catch{return {error:'song_url'};}
  }
  if(!value.song_path&&!value.song_url)return {error:'song'};
  const seconds=t=>{const m=/^(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(t);return m?Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')):null;};
  if(!value.start_time||!value.end_time)return {error:'start_time'};
  if(value.start_time){
    const start=seconds(value.start_time),end=seconds(value.end_time);
    if(start===null||end===null||end<=start||end-start>15.001)return {error:'start_time'};
  }
  return {value,id:match[2],tier:Number(match[1])};
}
export const checkoutUrl=ref=>DEPOSIT_LINK+'?client_reference_id='+encodeURIComponent(ref);

export async function prepareOrder(store,validated,insert,now=new Date()){
  const {value,id,tier}=validated;
  const fingerprint=digest(value),claimKey='claims/'+value.ref,orderKey='orders/'+value.ref;
  // Atomic, immutable claim must precede any database write. It is not proof of payment.
  await store.setJSON(claimKey,{fingerprint,createdAt:now.toISOString()},{onlyIfNew:true});
  const claim=await store.get(claimKey,{type:'json'});
  if(!claim)throw new Error('storage_unavailable');
  if(claim.fingerprint!==fingerprint)return {status:'conflict'};
  const existing=await store.get(orderKey,{type:'json'});
  if(existing)return {status:existing.fingerprint===fingerprint?'prepared':'conflict'};
  const row={id,ref:value.ref,artist_name:value.artist_name||'Artist',
    contact:'Email: '+value.email+' | Offer: $5 DEPOSIT MATERIALS | Payment: UNVERIFIED - check private deposit payment receipt before production | '+value.contact,
    photo_paths:value.photo_paths,song_path:value.song_path||'',song_url:value.song_url||null,
    start_time:value.start_time,end_time:value.end_time,style:value.style};
  const result=await insert(row);
  if(result!=='inserted'){
    // Another invocation might have just completed the identical request.
    const saved=await store.get(orderKey,{type:'json'});
    if(saved?.fingerprint===fingerprint)return {status:'prepared'};
    // INSERT-only permission cannot prove who created a duplicate row. Never
    // upgrade an uncertain/conflicting database insert to a checkout-ready order.
    return {status:result==='conflict'?'insert_unconfirmed':'unavailable'};
  }
  const record={version:1,fileVerification:validated.fileVerification||null,status:'materials_submitted',ref:value.ref,id,tier,email:value.email,
    artistName:value.artist_name||'Artist',createdAt:now.toISOString(),fingerprint,
    materialReadiness:'submitted',visualStyle:value.visual_style,photoCount:value.photo_paths.length,hasSongFile:Boolean(value.song_path),
    hasSongLink:Boolean(value.song_url),submission:row};
  await store.setJSON(orderKey,record,{onlyIfNew:true});
  const saved=await store.get(orderKey,{type:'json'});
  if(!saved)throw new Error('storage_unavailable');
  return {status:saved.fingerprint===fingerprint?'prepared':'conflict'};
}

// Call only with the expanded Checkout Session retrieved directly from Stripe
// using the server's existing secret, never the browser's summary or JSON body.
export function isVerifiedDepositSession(session){
  const s=session,pi=s?.payment_intent,c=pi?.latest_charge;
  if(!s||!/^cs_live_[A-Za-z0-9]{12,200}$/.test(s.id||'')||!REF.test(s.client_reference_id||'')||
    s.livemode!==true||s.mode!=='payment'||s.status!=='complete'||s.payment_status!=='paid'||
    s.payment_link?.url!==DEPOSIT_LINK||s.currency!=='usd'||s.amount_subtotal!==500||s.amount_total!==500||
    !pi||typeof pi.id!=='string'||!pi.id.startsWith('pi_')||pi.livemode!==true||pi.status!=='succeeded'||pi.currency!=='usd'||pi.amount!==500||pi.amount_received!==500||
    !c||typeof c.id!=='string'||!c.id.startsWith('ch_')||c.payment_intent!==pi.id||c.livemode!==true||
    c.status!=='succeeded'||c.paid!==true||c.captured!==true||c.currency!=='usd'||c.amount!==500||
    c.refunded!==false||c.amount_refunded!==0||c.disputed!==false)return false;
  return true;
}
export async function markDepositPaid(session,{openStore=productionStore,now=()=>new Date()}={}){
  if(!isVerifiedDepositSession(session))return {status:'not_eligible'};
  const s=session,pi=s.payment_intent,c=pi.latest_charge;
  const store=await openStore(),ref=s.client_reference_id;
  const order=await store.get('orders/'+ref,{type:'json'});
  if(!order||order.status!=='materials_submitted'||order.ref!==ref||!order.fingerprint)return {status:'unmatched'};
  const claim=await store.get('claims/'+ref,{type:'json'});
  if(claim?.fingerprint!==order.fingerprint)return {status:'unmatched'};
  const paymentFingerprint=digest({session:s.id,intent:pi.id,charge:c.id});
  const record={version:1,status:'deposit_paid_materials_submitted',ref,id:order.id,tier:order.tier,
    email:order.email,artistName:order.artistName,materialReadiness:order.materialReadiness,visualStyle:order.visualStyle,
    photoCount:order.photoCount,hasSongFile:order.hasSongFile,hasSongLink:order.hasSongLink,
    materialsCreatedAt:order.createdAt,verifiedPaidAt:now().toISOString(),amount:500,currency:'usd',
    orderFingerprint:order.fingerprint,paymentFingerprint};
  // Separate immutable marker prevents stale preparation retries from erasing payment.
  await store.setJSON('payments/'+ref,record,{onlyIfNew:true});
  const saved=await store.get('payments/'+ref,{type:'json'});
  if(!saved)throw new Error('storage_unavailable');
  return {status:saved.paymentFingerprint===paymentFingerprint&&saved.orderFingerprint===order.fingerprint?'matched_paid':'payment_conflict'};
}
