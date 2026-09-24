
document.querySelectorAll('[data-comparison]').forEach(card=>{
  const slider=card.querySelector('input[type=range]');
  const stage=card.querySelector('.compare-stage');
  const before=stage.querySelector('.compare-before');
  const divider=stage.querySelector('.compare-divider');
  const buttons=card.querySelectorAll('[data-value]');
  function setReveal(raw){
    const value=Math.max(0,Math.min(100,Number(raw)));
    slider.value=value;
    before.style.clipPath='inset(0 '+(100-value)+'% 0 0)';
    divider.style.left=value+'%';
    slider.setAttribute('aria-valuetext',Math.round(value)+' percent original photo');
    buttons.forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.value)===value?'true':'false'));
  }
  slider.addEventListener('input',()=>setReveal(slider.value));
  buttons.forEach(button=>button.addEventListener('click',()=>setReveal(button.dataset.value)));
  let dragging=false;
  const move=e=>{const rect=stage.getBoundingClientRect();setReveal((e.clientX-rect.left)/rect.width*100)};
  stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;dragging=true;stage.setPointerCapture(e.pointerId);move(e)});
  stage.addEventListener('pointermove',e=>{if(dragging)move(e)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(event=>stage.addEventListener(event,()=>{dragging=false}));
  setReveal(slider.value);
});
// Switch to direct checkout only when the offer is configured and launch-tested.
(async()=>{
  try{
    const response=await fetch('/.netlify/functions/toon-method-offer',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok)return;
    const data=await response.json();
    if(data.mode!=='checkout')return;
    const url=new URL(data.checkoutUrl);
    if(url.protocol!=='https:'||url.hostname!=='buy.stripe.com')return;
    const cta=document.getElementById('purchase-cta');
    cta.href=url.href;cta.textContent='Get The Toon Method · $49 ↗';
    cta.setAttribute('aria-label','Buy The Toon Method for $49 through Stripe');
    document.getElementById('purchase-details').textContent='Pay securely through Stripe. After payment verification, open your course immediately. No course approval needed. Your included Telegram group has a separate join request that Rich approves personally.';
  }catch{/* Keep the working Instagram purchase request as the fallback. */}
})();
// Render only verified data from the server-side TikTok Display API connection.
(async()=>{
  try{
    const response=await fetch('/.netlify/functions/toon-tiktok-stats',{credentials:'omit',signal:AbortSignal.timeout(8000)});
    if(!response.ok)return;
    const data=await response.json();
    if(data.status!=='live'||!Array.isArray(data.posts)||!data.sampleSize||!Number.isSafeInteger(data.totalViews)||!Number.isSafeInteger(data.totalLikes)||!Number.isFinite(Date.parse(data.updatedAt)))return;
    const number=new Intl.NumberFormat('en-US');
    document.getElementById('tracker-status').textContent='TikTok data · updated automatically';
    document.getElementById('tracker-description').textContent='Views and likes on the most recent '+data.sampleSize+' public ToonClipz posts, read from TikTok. Tap a post to verify.';
    document.getElementById('tracker-views').textContent=number.format(data.totalViews);
    document.getElementById('tracker-likes').textContent=number.format(data.totalLikes);
    document.getElementById('tracker-totals').hidden=false;
    const list=document.getElementById('tracker-posts');
    for(const post of data.posts.slice(0,3)){
      const li=document.createElement('li'),a=document.createElement('a'),small=document.createElement('small');
      const postUrl=new URL(post.url);if(postUrl.protocol!=='https:'||!(postUrl.hostname==='tiktok.com'||postUrl.hostname.endsWith('.tiktok.com')))continue;
      a.href=postUrl.href;a.target='_blank';a.rel='noopener noreferrer';
      a.textContent=(post.title||'Recent ToonClipz post').slice(0,90)+' ↗';
      small.textContent=number.format(post.views)+' views · '+number.format(post.likes)+' likes';
      li.append(a,small);list.append(li);
    }
    document.getElementById('tracker-updated').textContent='Last checked '+new Date(data.updatedAt).toLocaleString()+'.';
  }catch{/* Keep the direct TikTok link when the data connection is unavailable. */}
})();
