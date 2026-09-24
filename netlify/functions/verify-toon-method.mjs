// This offer has its own verifier. The $60 custom-video checkout cannot unlock it.
const LOGIN='https://richmadeit.netlify.app/university/workbook-login.html';
const CHECKOUT='https://buy.stripe.com/5kQ14o7INbdlbEbajp2wU05';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
}});

export function telegramInvite(raw){
  try{
    const url=new URL(raw);
    if(url.protocol==='https:'&&url.hostname==='t.me'&&!url.username&&!url.password&&!url.port&&
      /^\/(?:\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/.test(url.pathname)&&!url.search&&!url.hash)return url.href;
  }catch{}
  return null;
}

export function checkSession(session,id,linkId){
  const link=typeof session.payment_link==='string'?session.payment_link:session.payment_link?.id;
  const matchesOffer=linkId?link===linkId:session.payment_link?.url===CHECKOUT;
  if(session.id!==id||session.livemode!==true||session.mode!=='payment'||!matchesOffer||
    session.currency!=='usd'||session.amount_subtotal!==4900)return 'wrong_offer';
  if(session.status!=='complete'||session.payment_status!=='paid')return 'pending';
  const intent=session.payment_intent,charge=intent?.latest_charge;
  // Fail closed if the expanded payment/charge is missing or refunded/disputed.
  if(!intent||typeof intent!=='object'||intent.status!=='succeeded'||
    !charge||typeof charge!=='object'||charge.paid!==true||charge.status!=='succeeded'||
    charge.refunded!==false||charge.disputed!==false||charge.amount_refunded!==0)return 'unavailable';
  return 'verified';
}

export function createHandler({env=process.env,requestStripe=fetch}={}){
  return async function handler(request){
    if(request.method!=='POST')return reply(405,{status:'invalid_request'});
    const origin=request.headers.get('origin');
    if(origin&&origin!==new URL(request.url).origin)return reply(403,{status:'invalid_request'});
    let id;
    try{
      const body=await request.text();
      if(body.length>1024)return reply(400,{status:'invalid_request'});
      id=JSON.parse(body).session_id;
    }catch{return reply(400,{status:'invalid_request'});}
    if(typeof id!=='string'||!/^cs_live_[A-Za-z0-9]{12,200}$/.test(id))return reply(400,{status:'invalid_reference'});
    const key=env.STRIPE_SECRET_KEY,linkId=env.TOON_METHOD_PAYMENT_LINK_ID;
    if(!key||(linkId&&!/^plink_[A-Za-z0-9]+$/.test(linkId)))return reply(503,{status:'verification_unavailable'});
    try{
      const url=new URL('https://api.stripe.com/v1/checkout/sessions/'+id);
      url.searchParams.append('expand[]','payment_intent.latest_charge');
      url.searchParams.append('expand[]','payment_link');
      const response=await requestStripe(url,{headers:{Authorization:'Bearer '+key,'Stripe-Version':'2025-03-31.basil'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)return reply(response.status===404?404:502,{status:'verification_unavailable'});
      const state=checkSession(await response.json(),id,linkId);
      if(state!=='verified')return reply(state==='wrong_offer'?404:200,{status:state});
      return reply(200,{status:'verified',workbookUrl:LOGIN,telegramUrl:telegramInvite(env.TOON_METHOD_TELEGRAM_INVITE)});
    }catch{return reply(502,{status:'verification_unavailable'});}
  };
}
export default createHandler();
