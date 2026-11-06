import {authorized,json,secret} from './traffic/lib/core.mjs';
import {DEPOSIT_LINK,productionStore,isVerifiedDepositSession} from './_shared/deposit-orders.mjs';

// Owner-only reconciliation: no public order reads, no new credential, no
// browser return needed. Stored payment markers alone never prove current status.
export async function readDepositOrders({store,env,since,fetchImpl=fetch,now=Date.now()}){
  if(!env.STRIPE_SECRET_KEY)return {available:false,reason:'Live Stripe verification is not configured.'};
  let after,truncated=false,unmatched=0,needsReview=0,duplicatePayments=0;
  const orders=[],refs=new Set();
  for(let page=0;page<5;page++){
    const url=new URL('https://api.stripe.com/v1/checkout/sessions');
    url.searchParams.set('limit','100');url.searchParams.set('created[gte]',String(Math.floor(since/1000)));
    url.searchParams.append('expand[]','data.payment_intent.latest_charge');url.searchParams.append('expand[]','data.payment_link');
    if(after)url.searchParams.set('starting_after',after);
    const response=await fetchImpl(url,{headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Stripe unavailable');
    const data=await response.json();
    if(!Array.isArray(data.data))throw new Error('Invalid Stripe response');
    for(const session of data.data){
      if(session?.payment_link?.url!==DEPOSIT_LINK||session.livemode!==true||session.mode!=='payment'||session.status!=='complete'||session.payment_status!=='paid')continue;
      if(!isVerifiedDepositSession(session)){needsReview++;continue;}
      const ref=session.client_reference_id;
      if(refs.has(ref)){duplicatePayments++;continue;}
      refs.add(ref);
      const [order,claim]=await Promise.all([store.get('orders/'+ref,{type:'json'}),store.get('claims/'+ref,{type:'json'})]);
      if(!order||order.status!=='materials_submitted'||order.ref!==ref||!order.fingerprint||claim?.fingerprint!==order.fingerprint){unmatched++;continue;}
      // Only the existing owner session receives contact details. File paths,
      // raw Stripe objects, receipt URLs and all credentials stay server-side.
      orders.push({reference:ref,artistName:String(order.artistName||'Artist').slice(0,120),
        email:String(order.email||'').slice(0,254),tier:order.tier,
        materialsCreatedAt:order.createdAt,paidAt:session.created*1000,checkedAt:now,
        photoCount:Math.max(0,Math.min(5,Number(order.photoCount)||0)),
        hasSongFile:order.hasSongFile===true,hasSongLink:order.hasSongLink===true,
        startTime:String(order.submission?.start_time||'').slice(0,16),endTime:String(order.submission?.end_time||'').slice(0,16),
        state:'paid_materials_submitted',amount:500,currency:'usd'});
    }
    if(!data.has_more)break;
    if(page===4){truncated=true;break;}
    after=data.data.at(-1)?.id;if(!after)throw new Error('Invalid Stripe pagination');
  }
  orders.sort((a,b)=>b.paidAt-a.paidAt);
  return {available:true,orders,unmatched,needsReview,duplicatePayments,truncated,checkedAt:now,since};
}

export function createHandler({env=process.env,openStore=productionStore,fetchImpl=fetch,now=()=>Date.now()}={}){
  return async request=>{
    if(request.method!=='GET')return json(405,{error:'Method not allowed'});
    const key=secret(env);
    if(!key)return json(503,{error:'Dashboard setup is not complete.'});
    if(!authorized(request,key,now()))return json(401,{error:'Please sign in.'});
    const time=now(),since=time-(new URL(request.url).searchParams.get('range')==='7d'?7:1)*86400000;
    try{return json(200,await readDepositOrders({store:await openStore(),env,since,fetchImpl,now:time}));}
    catch{return json(503,{error:'Paid deposits could not be checked. Do not treat this as an empty queue. Refresh shortly or check Stripe and the materials admin.'});}
  };
}
export const config={rateLimit:{windowLimit:30,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
export default createHandler();
