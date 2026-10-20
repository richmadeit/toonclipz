(()=>{
  // Populate only with confirmed live Stripe Payment Links for these exact offers.
  const offers=Object.fromEntries(["deposit","30","60","180"].map(tier=>[tier,{price:5,url:"https://buy.stripe.com/eVqdRabZ33KTdMjfDJ2wU0b"}]));
  let ready=0;
  document.querySelectorAll('.checkout').forEach(a=>{
    const tier=a.dataset.tier,offer=offers[tier];
    if(!offer?.url)return;
    const u=new URL(offer.url);
    if(u.protocol!=='https:'||u.hostname!=='buy.stripe.com')return;
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const ref='TC-D'+(tier==='deposit'?'':tier)+'-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
    u.searchParams.set('client_reference_id',ref);a.href=u.href;a.removeAttribute('aria-disabled');ready++;
    a.addEventListener('click',()=>{if(navigator.globalPrivacyControl!==true&&window.toonclipzAnalyticsConsent!==false&&typeof fbq==='function')fbq('track','InitiateCheckout',{value:offer.price,currency:'USD',content_ids:['gta-'+tier],content_type:'product'});});
  });
  if(ready>0)document.getElementById('checkoutStatus').textContent='Secure checkout: $5 deposit today. Upload your photos and song after payment.';
})();

(()=>{const video=document.getElementById('fullFilm'),button=document.getElementById('playFullFilm');if(!video||!button)return;button.hidden=false;button.addEventListener('click',()=>{button.hidden=true;video.play().catch(()=>{button.hidden=false;});});video.addEventListener('play',()=>{button.hidden=true;});video.addEventListener('ended',()=>{button.hidden=false;});})();

(()=>{const previews=[...document.querySelectorAll('.hero-preview')];if(matchMedia('(prefers-reduced-motion: reduce)').matches)previews.forEach(v=>{v.pause();v.removeAttribute('autoplay');});})();

(()=>{
  const portfolio=window.toonclipzPortfolio,dialog=document.getElementById('portfolioDialog'),player=document.getElementById('portfolioPlayer');
  if(!portfolio||!dialog||!player)return;
  const selected=document.getElementById('selectedStyle'),label=document.getElementById('selectedStyleName'),dialogChoice=document.getElementById('dialogChooseStyle');
  function refresh(){const id=portfolio.read();selected.hidden=!id;label.textContent=id?portfolio.styles[id]:'';document.querySelectorAll('[data-choose-style]').forEach(a=>{if(a.dataset.chooseStyle===id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});}
  function close(){dialog.close();}
  document.querySelectorAll('[data-choose-style]').forEach(a=>a.addEventListener('click',()=>{portfolio.choose(a.dataset.chooseStyle);refresh();if(dialog.open)close();}));
  document.getElementById('clearStyle').addEventListener('click',()=>{portfolio.choose(null);refresh();});
  document.querySelectorAll('.checkout').forEach(a=>a.addEventListener('click',()=>{portfolio.rememberOrder(new URL(a.href).searchParams.get('client_reference_id'));}));
  document.querySelectorAll('[data-portfolio-video]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('video').forEach(v=>v.pause());
    document.getElementById('portfolioDialogTitle').textContent=button.dataset.portfolioTitle||portfolio.styles[button.dataset.style];
    dialogChoice.hidden=button.dataset.portfolioOnly==='true';
    dialogChoice.style.display=dialogChoice.hidden?'none':'';
    dialogChoice.dataset.chooseStyle=button.dataset.style||'';
    player.poster=button.querySelector('img').src;player.src=button.dataset.portfolioVideo;
    dialog.showModal();document.body.classList.add('portfolio-open');player.play().catch(()=>{});
  }));
  document.getElementById('closePortfolio').addEventListener('click',close);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  dialog.addEventListener('close',()=>{player.pause();player.removeAttribute('src');player.load();document.body.classList.remove('portfolio-open');});
  refresh();
})();

(()=>{const videos=[...document.querySelectorAll("video")];videos.forEach(current=>current.addEventListener("play",()=>{if(current.classList.contains("hero-preview"))return;videos.forEach(other=>{if(other!==current)other.pause();});}));})();
