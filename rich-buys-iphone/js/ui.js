(function(){'use strict';
const preview=window.RBI_PREVIEW===true;
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(route,body){
  if(preview)throw new Error('Owner preview only. No live request was sent.');
  const parsed=new URL(route,'https://rbi-route.invalid/');
  if(parsed.origin!=='https://rbi-route.invalid')throw new Error('Invalid order action.');
  const endpoint=new URL('/.netlify/functions/rbi-chips',location.origin);
  endpoint.searchParams.set('route',parsed.pathname.slice(1));
  parsed.searchParams.forEach((value,key)=>{if(key!=='route')endpoint.searchParams.append(key,value);});
  const r=await fetch(endpoint.pathname+endpoint.search,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  let j;try{j=await r.json();}catch{throw new Error('The order system is not connected. No request was confirmed.');}
  if(!r.ok)throw new Error(j.error||'This action could not be completed.');return j;
}
async function copy(value,button){
  try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);else{const ta=document.createElement('textarea');ta.value=value;ta.className='sr-only';document.body.append(ta);ta.select();if(!document.execCommand('copy'))throw new Error();ta.remove();}
    if(button){const old=button.textContent;button.textContent='Copied ✓';setTimeout(()=>button.textContent=old,1800);}return true;
  }catch{window.prompt('Copy this text:',value);return false;}
}
function setError(el,message){el.textContent=message;el.hidden=!message;}
function formatDate(value){if(!value)return 'Not posted yet';const d=new Date(value.length===10?value+'T12:00:00':value);if(Number.isNaN(d.getTime()))return 'Not posted yet';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d);}
function readAccess(){
  let data=null;const h=new URLSearchParams(location.hash.slice(1));if(h.get('id')&&h.get('key')){data={id:h.get('id'),key:h.get('key')};try{sessionStorage.setItem('rbi-chips-access',JSON.stringify(data));history.replaceState(null,'',location.pathname+location.search);}catch{}}
  if(!data){try{data=JSON.parse(sessionStorage.getItem('rbi-chips-access')||'null');}catch{}}
  return data;
}
function setAccess(access){try{sessionStorage.setItem('rbi-chips-access',JSON.stringify(access));}catch{}}
function orderLink(id,key){return new URL('track.html',location.href).href.split('#')[0]+'#'+new URLSearchParams({id,key});}
function secureKey(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function config(){
  if(preview)return {ready:false,supportURL:'',returnsPolicy:'',turnstileSiteKey:'',batch:null};
  try{const c=await api('config');document.querySelectorAll('[data-support]').forEach(a=>{if(c.supportURL){a.href=c.supportURL;a.hidden=false;a.textContent=c.supportLabel||'Message Rich';}});return c;}catch{return {ready:false};}
}
if(preview&&$('#previewBanner'))$('#previewBanner').hidden=false;
window.RBIUI={$,escape,api,copy,setError,formatDate,readAccess,setAccess,orderLink,secureKey,preview,config};
})();
