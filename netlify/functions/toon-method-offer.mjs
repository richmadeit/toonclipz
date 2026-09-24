import {telegramInvite} from './verify-toon-method.mjs';

export function offerConfig(env=process.env){
  // Enable only after the real lesson, buyer approval and Telegram path are tested.
  const manual={mode:'manual',price:49,currency:'USD'};
  if(env.TOON_METHOD_SALES_ENABLED!=='true'||!env.STRIPE_SECRET_KEY||
    !/^plink_[A-Za-z0-9]+$/.test(env.TOON_METHOD_PAYMENT_LINK_ID||'')||
    !telegramInvite(env.TOON_METHOD_TELEGRAM_INVITE))return manual;
  try{
    const url=new URL(env.TOON_METHOD_CHECKOUT_URL);
    if(url.protocol!=='https:'||url.hostname!=='buy.stripe.com'||url.username||url.password||url.port||
      !/^\/[A-Za-z0-9]+$/.test(url.pathname)||url.pathname.startsWith('/test_')||url.search||url.hash)return manual;
    return {mode:'checkout',price:49,currency:'USD',checkoutUrl:url.href};
  }catch{return manual;}
}
export default async function handler(request){
  return new Response(JSON.stringify(request.method==='GET'?offerConfig():{error:'Method not allowed'}),{
    status:request.method==='GET'?200:405,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  });
}
