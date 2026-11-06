(()=>{
const $=id=>document.getElementById(id),names={page_view:'Page viewed',get_started:'Get started clicked',form_start:'Form started',photos_ready:'Photos selected',song_ready:'Song selected',clip_selected:'Song section selected',details_saved:'Order details saved',checkout:'Checkout opened',form_error:'Upload failed',video_play:'Example played'};
let busy=false,signedIn=false,generation=0,brand=new URLSearchParams(location.search).get('brand')==='richmadeit'?'richmadeit':'toonclipz';
const number=n=>new Intl.NumberFormat().format(n),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100),source=s=>s.charAt(0).toUpperCase()+s.slice(1);
async function api(path,options={}){const r=await fetch('/.netlify/functions/'+path,{...options,cache:'no-store'});let d;try{d=await r.json();}catch{d={error:r.status===429?'Too many attempts. Wait a minute and try again.':'Unable to connect. Please try again.'};}if(!r.ok){const e=new Error(d.error);e.status=r.status;throw e;}return d;}
function gate(){generation++;signedIn=false;$('depositOrders').replaceChildren();$('depositCount').textContent='—';document.title='RichMadeIt + ToonClipz · Live activity';$('login').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;$('connection').textContent='Private access';}
function cell(row,text){const c=document.createElement('td');c.textContent=text;row.append(c);}
function renderOrders(d,error=''){
  $('depositPanel').hidden=brand!=='toonclipz';
  $('depositOrders').replaceChildren();
  if(error||!d?.available){$('depositCount').textContent='Unavailable';$('depositStatus').textContent=error||d?.reason||'Paid deposits could not be checked. This is not an empty queue.';document.title='ToonClipz · Check deposit connection';return;}
  const rows=Array.isArray(d.orders)?d.orders:[];
  $('depositCount').textContent=number(rows.length)+' matched';
  const notes=['Checked '+new Date(d.checkedAt).toLocaleTimeString()+'. '+(rows.length?'Payment verified; materials still need your review.':'No matched paid deposits in this period.')];
  if(d.unmatched)notes.push(number(d.unmatched)+' paid deposit(s) have no matching private intake. Check Stripe and the materials admin.');
  if(d.needsReview)notes.push(number(d.needsReview)+' payment(s) need manual review: missing reference, refund, dispute or incomplete verification.');
  if(d.duplicatePayments)notes.push(number(d.duplicatePayments)+' additional payment(s) reuse an order reference. Check Stripe before fulfillment.');
  if(d.truncated)notes.push('More than 500 checkouts: this list is incomplete.');
  $('depositStatus').textContent=notes.join(' ');
  document.title=rows.length?'('+rows.length+') ToonClipz · Paid deposits':'ToonClipz · Owner dashboard';
  for(const order of rows){
    const card=document.createElement('article');card.className='order-card';
    const heading=document.createElement('h3');heading.textContent=order.artistName+' · $5 paid';
    const ref=document.createElement('p');ref.className='order-reference';ref.textContent=order.reference;
    const contact=document.createElement('p');contact.textContent='Order contact: '+order.email;
    const detail=document.createElement('p');detail.textContent=order.tier+'-second package · '+order.photoCount+' photo(s) · '+(order.hasSongFile?'Song uploaded':order.hasSongLink?'Song link submitted':'Song needs review')+(order.startTime&&order.endTime?' · Preview '+order.startTime+'–'+order.endTime:' · Preview section needs review');
    const date=document.createElement('p');date.textContent='Checkout created '+new Date(order.paidAt).toLocaleString()+'. Match this reference in the materials admin.';
    card.append(heading,ref,contact,detail,date);$('depositOrders').append(card);
  }
}
function render(d){
  signedIn=true;$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;
  const t=d.traffic,p=d.purchases;
  $('recent').textContent=number(t.recent);$('views').textContent=number(t.pageViews);$('visits').textContent=number(t.sessions);
  $('purchases').textContent=p.available?number(p.count):'—';$('revenue').textContent=p.available?money(p.gross-p.refunds):'—';
  $('stripeNote').textContent=p.available?'Live '+(brand==='richmadeit'?'$50 RichMadeIt':'ToonClipz ($25 / $50 / $99 / $300, plus legacy)')+' checkouts created in this period. Excludes sandbox and $1 test links. Refunds: '+money(p.refunds)+'.':p.reason;
  const warnings=[];if(t.truncated)warnings.push('Traffic exceeds the 2,000 daily-session record limit for this view. Counts shown are incomplete.');if(p.truncated)warnings.push('Stripe results exceed 500 checkouts. Purchase totals shown are incomplete.');if(!p.available)warnings.push(p.reason);
  $('warning').hidden=!warnings.length;$('warning').textContent=warnings.join(' ');
  $('updated').textContent='Updated '+new Date(d.updatedAt).toLocaleTimeString()+' · '+new Date(d.since).toLocaleString()+' onward';$('connection').textContent='● Connected';
  $('chart').replaceChildren();const max=Math.max(1,...t.hours.map(h=>h.views));t.hours.forEach(h=>{const bar=document.createElement('div');bar.className='bar';bar.style.height=Math.max(1,h.views/max*100)+'%';bar.title=new Date(h.at).toLocaleTimeString([], {hour:'numeric'})+': '+h.views+' views';$('chart').append(bar);});$('chart').setAttribute('aria-label',t.hours.map(h=>new Date(h.at).toLocaleTimeString([], {hour:'numeric'})+': '+h.views+' views').join(', '));
  $('steps').replaceChildren();for(const k of (brand==='richmadeit'?['page_view','get_started','form_start','photos_ready','song_ready','clip_selected','details_saved','checkout']:['page_view','get_started','checkout','form_start','photos_ready','song_ready','details_saved'])){const row=document.createElement('div');row.className='step';const head=document.createElement('div');head.className='step-head';const label=document.createElement('span');label.textContent=names[k];const value=document.createElement('b');value.textContent=number(t.steps[k]||0);head.append(label,value);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=Math.min(100,(t.steps[k]||0)/Math.max(1,t.sessions)*100)+'%';track.append(fill);row.append(head,track);$('steps').append(row);}
  $('sources').replaceChildren();for(const s of t.sources){const row=document.createElement('div');row.className='source-row';const label=document.createElement('span');label.textContent=source(s.name);const count=document.createElement('b');count.textContent=number(s.sessions);row.append(label,count);$('sources').append(row);}if(!t.sources.length)$('sources').textContent='Sources will appear when visits arrive.';
  $('events').replaceChildren();for(const e of t.timeline){const row=document.createElement('tr');cell(row,new Date(e.at).toLocaleString());cell(row,names[e.type]||'Activity');cell(row,source(e.source));cell(row,source(e.device));$('events').append(row);}$('empty').hidden=t.timeline.length>0;
}
function setBrand(next){
 brand=next;generation++;$('depositPanel').hidden=brand!=='toonclipz';$('depositOrders').replaceChildren();document.title='RichMadeIt + ToonClipz · Live activity';
 const rich=brand==='richmadeit';
 $('activityBrand').textContent=rich?'RICHMADEIT / PREVIEW ACTIVITY':'TOONCLIPZ / ACTIVITY';
 $('purchaseLabel').textContent=rich?'$50 purchases':'$25 purchases';
 names.photos_ready=rich?'Artist photos added':'3–5 photos added';
 names.clip_selected=rich?'30 seconds selected':'15 seconds selected';
 $('showToonclipz').setAttribute('aria-pressed',String(!rich));
 $('showRichmadeit').setAttribute('aria-pressed',String(rich));
 $('openSite').href=rich?'https://richmadeit.netlify.app/preview/':'https://toonclipz.netlify.app/';
 history.replaceState(null,'',location.pathname+'?brand='+brand);
}
$('showToonclipz').addEventListener('click',()=>{if(busy)return;setBrand('toonclipz');refresh();});
$('showRichmadeit').addEventListener('click',()=>{if(busy)return;setBrand('richmadeit');refresh();});
setBrand(brand);
async function refresh(){
  if(busy)return;busy=true;
  const current=++generation;
  $('range').disabled=true;$('refresh').disabled=true;$('showToonclipz').disabled=true;$('showRichmadeit').disabled=true;
  if(!signedIn)$('dashboard').hidden=true;
  const [activityResult,ordersResult]=await Promise.allSettled([
    api('dashboard-data?range='+$('range').value+'&brand='+brand),
    brand==='toonclipz'?api('dashboard-orders?range='+$('range').value):Promise.resolve(null)
  ]);
  try{
    if(current!==generation)return;
    if(activityResult.status==='rejected')throw activityResult.reason;
    render(activityResult.value);
    if(brand==='toonclipz'){
      if(ordersResult.status==='rejected'&&ordersResult.reason.status===401){gate();return;}
      renderOrders(ordersResult.status==='fulfilled'?ordersResult.value:null,ordersResult.status==='rejected'?ordersResult.reason.message:'');
    }
  }catch(e){
    if(e.status===401||!signedIn){gate();if(e.status!==401)$('loginMessage').textContent=e.message;}
    else{
      $('warning').hidden=false;$('dashboard').hidden=false;
      for(const id of ['recent','views','visits','purchases','revenue'])$(id).textContent='—';
      for(const id of ['chart','steps','sources','events'])$(id).replaceChildren();
      $('warning').textContent=e.message;$('connection').textContent='Connection interrupted';
      if(brand==='toonclipz'){
        if(ordersResult.status==='rejected'&&ordersResult.reason.status===401){gate();return;}
        renderOrders(ordersResult.status==='fulfilled'?ordersResult.value:null,ordersResult.status==='rejected'?ordersResult.reason.message:'');
      }
    }
  }finally{busy=false;$('range').disabled=false;$('refresh').disabled=false;$('showToonclipz').disabled=false;$('showRichmadeit').disabled=false;}
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('signIn').disabled=true;$('loginMessage').textContent='Signing in…';try{await api('dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';$('loginMessage').textContent='';await refresh();}catch(e){$('loginMessage').textContent=e.message;}finally{$('signIn').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"logout":true}'});gate();}catch(e){$('warning').hidden=false;$('warning').textContent=e.message;}});
$('refresh').addEventListener('click',refresh);$('range').addEventListener('change',refresh);
try{$('exclude').checked=localStorage.getItem('toonclipz.exclude-own-visits')==='1';}catch{}
$('exclude').addEventListener('change',()=>{try{localStorage.setItem('toonclipz.exclude-own-visits',$('exclude').checked?'1':'0');}catch{$('warning').hidden=false;$('warning').textContent='Your browser blocked saving this preference.';}});
setInterval(()=>{if(signedIn&&!document.hidden)refresh();},30000);document.addEventListener('visibilitychange',()=>{if(signedIn&&!document.hidden)refresh();});refresh();
})();

