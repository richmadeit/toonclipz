import {createHash} from 'node:crypto';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async function handler(request){
  if(request.method!=='POST') return reply(405,{error:'Method not allowed'});
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return reply(403,{error:'Invalid origin'});
  let id; try {({session_id:id}=await request.json());} catch {return reply(400,{error:'Invalid request'});}
  if(typeof id!=='string'||!/^cs_(test|live)_[A-Za-z0-9]{12,200}$/.test(id)) return reply(400,{error:'Invalid payment reference'});
  const test=id.startsWith('cs_test_');
  const key=process.env[test?'STRIPE_TEST_SECRET_KEY':'STRIPE_SECRET_KEY'];
  const allowed=(process.env[test?'STRIPE_TEST_PAYMENT_LINK_IDS':'STRIPE_PAYMENT_LINK_IDS']||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!key||(test&&!allowed.length)) return reply(503,{error:'Payment verification is temporarily unavailable. Please keep your Stripe receipt; do not pay again.'});
  try{
    const url=new URL('https://api.stripe.com/v1/checkout/sessions/'+id);
    url.searchParams.append('expand[]','payment_intent.latest_charge');
    url.searchParams.append('expand[]','payment_link');
    const res=await fetch(url,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
    if(!res.ok) return reply(res.status===404?404:502,{error:'Unable to verify this payment. Keep your Stripe receipt and try again shortly.'});
    const s=await res.json();
    const linkId=typeof s.payment_link==='string'?s.payment_link:s.payment_link?.id;
    const currentOffer=!test && s.payment_link?.url==='https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04';
    if(s.livemode!==!test||s.mode!=='payment'||!(currentOffer||allowed.includes(linkId))) return reply(404,{error:'Payment not found for this store'});
    if(s.status!=='complete'||s.payment_status!=='paid') return reply(200,{paid:false,test,status:s.status==='expired'?'expired':'pending'});
    const charge=s.payment_intent?.latest_charge;
    const card=charge?.payment_method_details?.card;
    let receipt=null;
    try{const u=new URL(charge?.receipt_url); if(u.protocol==='https:'&&(u.hostname==='stripe.com'||u.hostname.endsWith('.stripe.com')))receipt=u.href;}catch{}
    const email=s.customer_details?.email||s.customer_email||'';
    const maskedEmail=email.includes('@')?email.slice(0,1)+'•••@'+email.split('@')[1]:null;
    return reply(200,{paid:true,test,amount:s.amount_total,currency:s.currency,tax:s.total_details?.amount_tax||0,
      reference:s.client_reference_id||'TC-'+id.slice(-10),hasOrderReference:!!s.client_reference_id,
      email:maskedEmail,method:card?card.brand+' •••• '+card.last4:charge?.payment_method_details?.type||'Stripe',receipt,
      refunded:!!charge?.refunded,eventId:'tc_'+createHash('sha256').update(id).digest('hex').slice(0,32)});
  }catch{return reply(502,{error:'Unable to check payment right now. Please try again; do not pay again.'});}
}
