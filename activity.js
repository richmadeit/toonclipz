/* First-party, anonymous activity. Never send form values, filenames, email,
   full URLs, payment references, or card details. */
(()=>{
  if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.toonclipzAnalyticsConsent===false)return;
  try{if(localStorage.getItem('toonclipz.exclude-own-visits')==='1')return;}catch{}
  let state;
  try{state=JSON.parse(sessionStorage.getItem('tc.activity.session'));}catch{}
  if(!state||typeof state.id!=='string'||!Array.isArray(state.seen)||!Number.isFinite(state.last)||Date.now()-state.last>1800000)state={id:crypto.randomUUID(),last:Date.now(),seen:[]};
  const params=new URLSearchParams(location.search);
  const source=(params.get('utm_source')||'').toLowerCase();
  let ref='';try{ref=new URL(document.referrer).hostname;}catch{}
  const matches=(host,base)=>host===base||host.endsWith('.'+base);
  if(!state.source)state.source=['ig','instagram'].includes(source)||matches(ref,'instagram.com')?'instagram':['fb','facebook','meta'].includes(source)||matches(ref,'facebook.com')?'facebook':['tt','tiktok'].includes(source)||matches(ref,'tiktok.com')?'tiktok':source==='google'||matches(ref,'google.com')?'google':source||ref&&ref!==location.hostname?'other':'direct';
  const device=matchMedia('(max-width: 600px)').matches?'mobile':matchMedia('(max-width: 1024px)').matches?'tablet':'desktop';
  function track(type){try{
    if(navigator.globalPrivacyControl===true||window.toonclipzAnalyticsConsent===false)return;
    try{if(localStorage.getItem('toonclipz.exclude-own-visits')==='1')return;}catch{}
    if(type!=='page_view'&&state.seen.includes(type))return;
    if(!state.seen.includes(type))state.seen.push(type);
    state.last=Date.now();try{sessionStorage.setItem('tc.activity.session',JSON.stringify(state));}catch{}
    fetch('/.netlify/functions/traffic',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({id:crypto.randomUUID(),session:state.id,type,source:state.source,device})}).catch(()=>{});
  }catch{/* Analytics must never interrupt an order. */}}
  window.toonclipzActivity=track;
  track('page_view');
  document.getElementById('f')?.addEventListener('input',()=>track('form_start'),{once:true});
  document.addEventListener('click',e=>{
    const link=e.target.closest('a');if(!link)return;
    if(link.getAttribute('href')==='#previewIntent')track('get_started');
    if(link.id==='checkoutLink')track('checkout');
  });
  document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>track('video_play'),{once:true}));
})();
