const status=document.getElementById('payment-status');
const panel=document.getElementById('verified-access');
const join=document.getElementById('telegram-join');
const groupStatus=document.getElementById('group-status');
const retry=document.getElementById('retry');
const storageKey='toon-method-payment-reference';
const url=new URL(location.href);
let reference=url.searchParams.get('session_id');
if(reference){
  // Do not retain payment references in the address bar or outbound referrers.
  url.searchParams.delete('session_id');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  try{if(/^cs_live_[A-Za-z0-9]{12,200}$/.test(reference))sessionStorage.setItem(storageKey,reference);}catch{}
}else{
  try{reference=sessionStorage.getItem(storageKey);}catch{}
}
async function verify(){
  panel.hidden=true;join.hidden=true;join.removeAttribute('href');retry.hidden=true;
  if(!reference){
    status.textContent='Already paid? Open the return page from checkout, or send your receipt and Google email using the access-help link below. You do not need to pay again.';
    return;
  }
  status.textContent='Checking your Toon Method payment…';
  try{
    const response=await fetch('/.netlify/functions/verify-toon-method',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',
      body:JSON.stringify({session_id:reference}),signal:AbortSignal.timeout(15000)
    });
    const data=await response.json();
    if(response.ok&&data.status==='verified'){
      status.textContent='Payment verified. Your lesson package includes the Telegram group at no extra charge.';
      panel.hidden=false;
      let invite=null;
      try{const u=new URL(data.telegramUrl);if(u.protocol==='https:'&&u.hostname==='t.me'&&/^\/(?:\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/.test(u.pathname))invite=u.href;}catch{}
      if(invite){join.href=invite;join.hidden=false;groupStatus.textContent='Tap below to join the buyer group. If the group requires approval, submit your join request.';}
      else{groupStatus.textContent='Request your included Telegram invite using the access-help link below. Send your receipt so Rich can confirm your purchase.';}
      return;
    }
    status.textContent=data.status==='pending'
      ?'Your payment has not completed yet. Check your Stripe receipt and try again shortly. Do not pay a second time.'
      :'We could not confirm access from this link. If you paid, send your receipt and Google email using access help below. Do not pay again.';
  }catch{status.textContent='The payment check could not connect. Try again, or use access help with your receipt. Do not pay again.';}
  retry.hidden=false;
}
retry.addEventListener('click',verify);
verify();
