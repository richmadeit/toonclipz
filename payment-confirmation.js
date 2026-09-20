(()=>{
const $=id=>document.getElementById(id);
const session=new URLSearchParams(location.search).get('session_id');
// Remove the bearer-like session reference before loading analytics or following links.
history.replaceState(null,'',location.pathname);
function purchase(p){
  if(p.test||p.refunded)return;
  const key='toonclipz.purchase.'+p.eventId;
  try{if(localStorage.getItem(key))return;}catch{}
  const f=window;
  if(!f.fbq){const n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(s);f.fbq('init','1066699776252161');}
  f.fbq('track','Purchase',{value:p.amount/100,currency:p.currency.toUpperCase(),content_name:'ToonClipz 15-second music video'},{eventID:p.eventId});
  try{localStorage.setItem(key,'queued');}catch{}
}
async function check(){
  $('retry').hidden=true;
  if(!session){$('title').textContent='Your payment confirmation';$('message').textContent='After checkout, Stripe will bring you here with your payment details. If you already paid, keep your Stripe receipt—do not pay again.';return;}
  $('title').textContent='Checking your payment…';
  try{
    const r=await fetch('/.netlify/functions/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:session})});
    const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to verify payment. Please try again.');
    if(!p.paid){$('title').textContent=p.status==='expired'?'Checkout expired':'Payment not yet confirmed';$('message').textContent='We have not confirmed a successful payment for this checkout. If you submitted payment, wait and check again before paying again.';$('retry').hidden=false;return;}
    const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency}).format(n/100);
    $('title').textContent=p.test?'Test payment confirmed':p.refunded?'Payment refunded':'Payment confirmed. Thank you!';
    $('message').textContent=p.test?'Sandbox test only. No real money was charged and no video order is being placed.':'Your payment details are verified with Stripe. Keep your receipt for your records.';
    $('status').hidden=false;$('status').textContent=p.test?'SANDBOX':p.refunded?'REFUNDED':'PAID';
    for(const [id,value]of Object.entries({amount:money(p.amount),tax:money(p.tax),method:p.method,email:p.email||'See your Stripe receipt',reference:p.reference}))$(id).textContent=value;
    $('details').hidden=false;
    if(p.receipt){$('receipt').href=p.receipt;$('receipt').hidden=false;}
    if(!p.hasOrderReference)$('next').textContent='This payment has no linked website submission. Contact ToonClipz with your receipt so we can match your photos, song section, and mood before starting.';
    if(p.test||p.refunded)$('next').textContent=p.test?'Sandbox verification is complete. Test payments are excluded from live Meta Purchase tracking.':'Contact ToonClipz if you have questions about this refunded payment.';
    purchase(p);
  }catch(e){$('title').textContent='We couldn’t check your payment';$('message').textContent=e.message;$('retry').hidden=false;}
}
$('retry').addEventListener('click',check);check();
})();
