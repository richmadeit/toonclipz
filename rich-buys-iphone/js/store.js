(async function(){'use strict';
const U=RBIUI,R=RBIRules,$=U.$;let conf={ready:false},token='',widget=null,sending=false,submitted=false,keys=null;
let items=R.products.map(p=>({id:p.id,qty:0}));
try{const saved=JSON.parse(localStorage.getItem('rbi-chips-cart')||'[]');const clean=R.cart(saved);items=items.map(i=>({...i,qty:clean.find(x=>x.id===i.id)?.qty||0}));}catch{}
$('#products').innerHTML=R.products.map(p=>`<article class="product" id="card-${p.id}"><div class="product-visual"><span class="series">${p.series} SERIES</span><img src="assets/${p.image}" alt="Supplier image labeled for ${U.escape(p.label)}" loading="lazy" width="310" height="326"></div><div class="product-content"><span class="eyebrow">1 CHIP TYPE</span><h3>${U.escape(p.label)}</h3><p class="small">${U.escape(p.excludes)}</p>${p.tutorialUrl ? `<div class="tutorial-link"><a class="btn smallbtn" href="${U.escape(p.tutorialUrl)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="Open ${U.escape(p.tutorialLabel)} on the supplier site in a new tab">${U.escape(p.tutorialLabel)} <span aria-hidden="true">↗</span></a><p class="small">Supplier link from Rich.<br>Video review pending.</p></div>` : ''}<div class="qtyrow"><span class="subtotal">Quantity</span><div class="qtycontrols"><button type="button" data-minus="${p.id}" aria-label="Remove one ${U.escape(p.label)} chip">−</button><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" id="${p.id}" value="${items.find(i=>i.id===p.id).qty}" aria-label="${U.escape(p.label)} quantity"><button type="button" data-plus="${p.id}" aria-label="Add one ${U.escape(p.label)} chip">+</button></div></div></div></article>`).join('');
function update(){
  const c=R.price(items),q=c.quantity;try{localStorage.setItem('rbi-chips-cart',JSON.stringify(items));}catch{}
  const msg=q<5?`${q} of 5 — add ${5-q} more`:`${q} chips — minimum met`;
  $('#progressLabel').textContent=msg;$('#progress').value=Math.min(q,5);$('#totalQuantity').textContent=q;$('#subtotal').textContent=R.money(c.subtotalCents);$('#stickyProgress').textContent=msg;$('#stickySubtotal').textContent=c.bulk?'Repair-shop quote required':`${R.money(c.subtotalCents)} before shipping / tax`;
  $('#cartLines').innerHTML=c.items.length?c.items.map(i=>`<div class="line"><span>${U.escape(R.byId[i.id].short)}</span><b>× ${i.qty}</b></div>`).join(''):'<p class="small">Your chips will show up here.</p>';
  $('#tier15').classList.toggle('active',q>0&&q<10);$('#tier13').classList.toggle('active',q>=10&&q<20);
  $('#bulkNote').textContent=c.bulk?'20+ chips: repair shops only. Rich must quote the price.':'Shipping and any tax are extra until quoted.';
  $('#tierHint').hidden=q!==9;$('#tierHint').textContent='Add any 1 chip: 10 cost $130 — $5 less than 9. This uses the $13 tier for all 10.';
  R.products.forEach(p=>$('#card-'+p.id).classList.toggle('selected',items.find(i=>i.id===p.id).qty>0));
  const button=$('#submitRequest');button.disabled=!c.eligible||!conf.ready||sending||submitted;
  button.textContent=submitted?'Request sent ✓':sending?'Sending…':q<5?'Choose 5 chips first':!conf.ready?(U.preview?'Preview only — not sending':'Preorders are not open yet'):c.bulk?'Send repair-shop quote request':'Send my preorder request';
  return c;
}
function setQty(id,value){const qty=Math.max(0,Math.min(99,Math.trunc(Number(value)||0)));items.find(i=>i.id===id).qty=qty;$('#'+id).value=qty;update();}
$('#products').addEventListener('click',e=>{const p=e.target.closest('[data-plus]'),m=e.target.closest('[data-minus]');if(p||m){const id=p?p.dataset.plus:m.dataset.minus;setQty(id,items.find(i=>i.id===id).qty+(p?1:-1));}});
R.products.forEach(p=>{const el=$('#'+p.id);el.addEventListener('input',()=>{if(!/^[0-9]{0,2}$/.test(el.value)){el.value=items.find(i=>i.id===p.id).qty;U.setError($('#quantityError'),'Use a whole number from 0 to 99. Your previous quantity was kept.');return;}U.setError($('#quantityError'),'');setQty(p.id,el.value);});});
$('#buyerType').addEventListener('change',()=>{$('#buyerBusiness').required=$('#buyerType').value==='shop';});
$('#requestForm').addEventListener('submit',async e=>{
  e.preventDefault();U.setError($('#formError'),'');if(sending||submitted)return;
  const c=update();if(!c.eligible){U.setError($('#formError'),'Choose at least 5 chips first.');return;}
  if(!conf.ready){U.setError($('#formError'),'Preorders are not open. No request was sent.');return;}
  if(c.bulk&&$('#buyerType').value!=='shop'){U.setError($('#formError'),'20+ chips are for repair shops only. Choose “Repair shop” or reduce your quantity.');return;}
  const form=e.currentTarget;if(!form.reportValidity())return;
  if(!keys)keys={accessKey:U.secureKey(),requestKey:crypto.randomUUID()};
  const b=Object.fromEntries(new FormData(form));for(const k of ['experienced','preorder','contactConsent'])b[k]=form.elements[k].checked;
  Object.assign(b,{items:c.items,turnstileToken:token,...keys});sending=true;update();
  try{
    const result=await U.api('orders',b);submitted=true;U.setAccess({id:result.id,key:keys.accessKey});const link=U.orderLink(result.id,keys.accessKey);
    const receipt=$('#receipt');receipt.innerHTML=`<span class="eyebrow">REQUEST RECEIVED</span><h2>Save your private link.</h2><p><b>${U.escape(result.id)}</b></p><p>No payment was taken. Rich will review your mix. This link becomes your paid-order tracker once Rich verifies payment.</p><input class="private-link" readonly aria-label="Your private order link" value="${U.escape(link)}"><div class="actions"><a class="btn primary" href="${U.escape(link)}">Open my order ↗</a><button type="button" id="copyReceipt" class="btn">Copy private link</button><button type="button" id="saveReceipt" class="btn ghost">Save confirmation</button></div><p class="fine">Keep this link private. Do not put it in a public post or Telegram group.</p>`;receipt.hidden=false;
    $('#copyReceipt').onclick=e=>U.copy(link,e.currentTarget);$('#saveReceipt').onclick=()=>{const blob=new Blob([`RICH BUYS IPHONES\n${result.id}\nPRIVATE ORDER LINK\n${link}\n\nNo payment was taken when this request was submitted. Keep this link private.\n`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=result.id+'-private.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);};
    receipt.focus();receipt.scrollIntoView({block:'center',behavior:'smooth'});
  }catch(err){U.setError($('#formError'),err.message);if(window.turnstile&&widget!=null)window.turnstile.reset(widget);token='';}
  finally{sending=false;update();}
});
update();conf=await U.config();
const availability=$('#availability');
if(U.preview){availability.hidden=true;}
else if(conf.ready){availability.classList.add('green');availability.textContent='Preorders are open. Request first. Pay only after Rich approves your quote.';}
else availability.textContent='Preorders are not open yet. You can build a mix, but cannot send an order or payment.';
if(conf.batch){$('#batchInfo').innerHTML=`<b>${U.escape(conf.batch.label)}</b><br>Request cutoff: ${U.formatDate(conf.batch.closesOn)}<br>Supplier order planned by: ${U.formatDate(conf.batch.orderBy)}<br>Next update: ${U.formatDate(conf.batch.nextUpdateOn)}${conf.batch.note?'<p class="mt16">'+U.escape(conf.batch.note)+'</p>':''}`;}
if(conf.ready&&conf.turnstileSiteKey){window.rbiTurnstileReady=()=>{widget=window.turnstile.render('#turnstileBox',{sitekey:conf.turnstileSiteKey,action:'preorder',theme:'dark',callback:t=>{token=t;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';U.setError($('#formError'),'The security check could not load. Reload before sending.');}});};const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=rbiTurnstileReady&render=explicit';script.async=true;script.onerror=()=>U.setError($('#formError'),'The security check is unavailable. Try again later.');document.head.append(script);}
update();
})();
