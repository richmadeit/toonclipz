(()=>{
'use strict';
const $=id=>document.getElementById(id),endpoint='/.netlify/functions/dashboard-free-video';
let busy=false,generation=0,signedIn=false,pendingRefresh=false,cursor='',nextCursor=null;
const previousCursors=[];
const time=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
async function api(url,options={}){const response=await fetch(url,{...options,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000)});let data;try{data=await response.json();}catch{throw new Error('Could not read the server response. Please refresh.');}if(!response.ok){const error=new Error(data.error||'Could not load entries.');error.status=response.status;throw error;}return data;}
function gate(){generation++;signedIn=false;pendingRefresh=false;$('entries').replaceChildren();$('inbox').hidden=true;$('login').hidden=false;$('page-message').textContent='';}
function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
function link(card,label,href,download=false){const a=text('a',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';if(download)a.download='';card.append(a);}
function render(data){
 $('entries').replaceChildren();
 for(const item of data.entries){
  const card=document.createElement('article');card.className='entry';
  card.append(text('h2',item.artistName),text('p','Contact: '+item.email),text('p',new Date(item.createdAt).toLocaleString()+' · 15 seconds: '+time(item.startSeconds)+'–'+time(item.startSeconds+15)));
  const ref=text('p','Reference: '+item.reference);ref.className='ref';card.append(ref);
  const base=endpoint+'?reference='+encodeURIComponent(item.reference);
  if(item.hasPhoto){const img=document.createElement('img');img.src=base+'&file=photo';img.alt='Submitted reference photo';img.loading='lazy';card.append(img);link(card,'Download photo',base+'&file=photo&download=1',true);}
  else card.append(text('p','Older entry: no photo submitted. Request a photo before making a video.'));
  if(item.hasAudio){const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=base+'&file=audio';card.append(audio);link(card,'Download audio',base+'&file=audio&download=1',true);}
  try{const url=new URL(item.songUrl);if(url.protocol==='https:'&&!url.username&&!url.password)link(card,'Open song link',url.href);}catch{}
  card.append(text('p','Permission recorded: '+String(item.rightsVersion||'not available')+'. Review content and permissions before use.'));
  $('entries').append(card);
 }
 nextCursor=data.nextCursor||null;$('next').hidden=!nextCursor;$('previous').hidden=!previousCursors.length;
 $('status').textContent=data.entries.length+' submission(s) on this page, sorted by time. Checked '+new Date(data.checkedAt).toLocaleTimeString()+'.'+(nextCursor?' More entries are available on the next page.':'')+(cursor||nextCursor?' Pages are grouped by reference, not globally by date.':'');
}
async function refresh(){if(busy){pendingRefresh=true;return;}busy=true;pendingRefresh=false;const current=++generation;$('refresh').disabled=true;try{const data=await api(endpoint+(cursor?'?after='+encodeURIComponent(cursor):''));if(current!==generation)return;signedIn=true;$('login').hidden=true;$('inbox').hidden=false;$('page-message').textContent='';render(data);}catch(error){if(current!==generation)return;$('entries').replaceChildren();if(error.status===401)gate();else{$('page-message').textContent=error.message+' No entries are shown until the connection is verified.';}}finally{busy=false;$('refresh').disabled=false;if(pendingRefresh&&!document.hidden)refresh();}}
$('refresh').addEventListener('click',refresh);
$('next').addEventListener('click',()=>{if(busy||!nextCursor)return;previousCursors.push(cursor);cursor=nextCursor;refresh();});
$('previous').addEventListener('click',()=>{if(busy||!previousCursors.length)return;cursor=previousCursors.pop();refresh();});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();$('sign-in').disabled=true;try{await api('/.netlify/functions/dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';$('login-message').textContent='';await refresh();}catch(error){$('login-message').textContent=error.message;}finally{$('sign-in').disabled=false;}});
$('logout').addEventListener('click',async()=>{generation++;$('entries').replaceChildren();try{await api('/.netlify/functions/dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"logout":true}'});gate();}catch(error){$('page-message').textContent=error.message;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;$('entries').replaceChildren();$('status').textContent='Refresh to reload private entries.';}else refresh();});
window.addEventListener('pagehide',()=>{generation++;$('entries').replaceChildren();});
window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
refresh();
})();
