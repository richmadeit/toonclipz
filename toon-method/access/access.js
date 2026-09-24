const status=document.getElementById('payment-status');
const panel=document.getElementById('verified-access');
const join=document.getElementById('telegram-join');
const groupStatus=document.getElementById('group-status');
const retry=document.getElementById('retry');
const courseStatus=document.getElementById('course-status');
const openCourse=document.getElementById('open-course');
const legacyLogin=document.getElementById('legacy-login');
const reader=document.getElementById('course-reader');
const frame=document.getElementById('course-frame');
let courseReady=false;
const storageKey='toon-method-payment-reference';
const url=new URL(location.href);
let reference=url.searchParams.get('session_id');
if(reference){
  // Do not retain payment references in the address bar or outbound referrers.
  url.searchParams.delete('session_id');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  try{if(/^cs_live_[A-Za-z0-9]{12,200}$/.test(reference))localStorage.setItem(storageKey,reference);}catch{}
}else{
  try{reference=localStorage.getItem(storageKey)||sessionStorage.getItem(storageKey);}catch{}
}
async function verify(){
  panel.hidden=true;openCourse.hidden=true;legacyLogin.hidden=true;courseReady=false;reader.hidden=true;frame.removeAttribute('srcdoc');join.hidden=true;join.removeAttribute('href');retry.hidden=true;
  if(!reference){
    status.textContent='Already paid? Open the return page from checkout, or send your receipt using the access-help link below. You do not need to pay again.';
    return;
  }
  status.textContent='Checking your Toon Method payment…';
  try{
    const response=await fetch('/.netlify/functions/verify-toon-method',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',
      body:JSON.stringify({session_id:reference}),signal:AbortSignal.timeout(25000)
    });
    const data=await response.json();
    if(response.ok&&data.status==='verified'){
      status.textContent='Payment verified. Your lesson package includes the Telegram group at no extra charge.';
      panel.hidden=false;
      if(data.course?.mode==='automatic'){
        courseReady=true;openCourse.hidden=false;
        courseStatus.textContent='Your course is ready. No account approval is needed. Open it below.';
      }else if(data.course?.mode==='manual'){
        legacyLogin.hidden=false;courseStatus.textContent='This checkout is still using the existing approved-email login. Contact access help if needed.';
      }else{
        courseStatus.textContent='Payment confirmed. Course delivery is temporarily unavailable; retry shortly or contact access help. Do not pay again.';retry.hidden=false;
      }
      let invite=null;
      try{const u=new URL(data.telegramUrl);if(u.protocol==='https:'&&u.hostname==='t.me'&&/^\/(?:\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/.test(u.pathname))invite=u.href;}catch{}
      if(invite){join.href=invite;join.hidden=false;groupStatus.textContent='Use the invitation to request admission. Rich approves Telegram separately; your course does not require group approval.';}
      else{groupStatus.textContent='Request your included Telegram invite using the access-help link below. Send your receipt so Rich can confirm your purchase.';}
      return;
    }
    status.textContent=data.status==='pending'
      ?'Your payment has not completed yet. Check your Stripe receipt and try again shortly. Do not pay a second time.'
      :'We could not confirm access from this link. If you paid, send your receipt using access help below. Do not pay again.';
  }catch{status.textContent='The payment check could not connect. Try again, or use access help with your receipt. Do not pay again.';}
  retry.hidden=false;
}
retry.addEventListener('click',verify);
verify();


// Fetch a fresh short-lived file URL only after rechecking the payment.
openCourse.addEventListener('click',async()=>{
 if(!courseReady||!reference)return;
 openCourse.disabled=true;courseStatus.textContent='Opening your course…';
 try{
  const check=await fetch('/.netlify/functions/verify-toon-method',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify({session_id:reference}),signal:AbortSignal.timeout(25000)});
  const data=await check.json();
  if(!check.ok||data.status!=='verified'||data.course?.mode!=='automatic')throw Error('access-unavailable');
  const url=new URL(data.course.url);
  if(url.origin!=='https://molqlfdjlmnlkscecngz.supabase.co'||url.pathname!=='/storage/v1/object/sign/paid-workbooks/Richmadeit-University-Interactive-Workbook.html'||!url.searchParams.get('token'))throw Error('invalid-file');
  const response=await fetch(url.href,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('file-unavailable');
  const html=await response.text();
  if(!/^\s*<!doctype html/i.test(html)||html.length<1000)throw Error('invalid-workbook');
  // Only the owner's trusted course HTML belongs at this private storage path.
  frame.srcdoc=html;reader.hidden=false;courseStatus.textContent='Your course is open.';
 }catch{
  reader.hidden=true;frame.removeAttribute('srcdoc');courseStatus.textContent='We could not open the course. Check payment again or contact access help with your receipt. Do not pay again.';retry.hidden=false;
 }finally{openCourse.disabled=false;}
});
document.getElementById('close-course').addEventListener('click',()=>{reader.hidden=true;frame.removeAttribute('srcdoc');});
