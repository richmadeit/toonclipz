(()=>{
  // Populate only with confirmed live Stripe Payment Links for these exact offers.
  const offers={"15":{"price":25,"url":"https://buy.stripe.com/4gM4gAd37ftB23B8bh2wU06"},"30":{"price":50,"url":"https://buy.stripe.com/bJe7sM6EJa9h6jR2QX2wU07"},"60":{"price":99,"url":"https://buy.stripe.com/9B6dRa4wB0yH6jRfDJ2wU08"}};
  offers["180"]={price:300,url:"https://buy.stripe.com/8x2aEY1kpchp9w3bnt2wU09"};
  let ready=0;
  document.querySelectorAll('.checkout').forEach(a=>{
    const tier=a.dataset.tier,offer=offers[tier];
    if(!offer?.url)return;
    const u=new URL(offer.url);
    if(u.protocol!=='https:'||u.hostname!=='buy.stripe.com')return;
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const ref='TC-'+tier+'-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
    u.searchParams.set('client_reference_id',ref);a.href=u.href;a.removeAttribute('aria-disabled');ready++;
    a.addEventListener('click',()=>{if(typeof fbq==='function')fbq('track','InitiateCheckout',{value:offer.price,currency:'USD',content_ids:['gta-'+tier],content_type:'product'});});
  });
  if(ready===Object.keys(offers).length)document.getElementById('checkoutStatus').textContent='Secure checkout. Upload your photos and song after payment.';
})();

(()=>{const video=document.getElementById('fullFilm'),button=document.getElementById('playFullFilm');if(!video||!button)return;button.hidden=false;button.addEventListener('click',()=>{button.hidden=true;video.play().catch(()=>{button.hidden=false;});});video.addEventListener('play',()=>{button.hidden=true;});video.addEventListener('ended',()=>{button.hidden=false;});})();
