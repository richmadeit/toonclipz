(async function(){'use strict';const U=RBIUI,$=U.$;const access=U.readAccess();let pack,category='Start here';
function fill(s){const shop=$('#packShop').value.trim()||'[SHOP NAME]',city=$('#packCity').value.trim()||'[CITY]';return String(s||'').replaceAll('[SHOP NAME]',shop).replaceAll('[CITY]',city);}
function render(){
 $('#packTabs').innerHTML=pack.categories.map(c=>`<button class="btn smallbtn ${category===c?'active':''}" type="button" data-category="${U.escape(c)}" aria-pressed="${category===c}">${U.escape(c)}</button>`).join('');
 $('#packCards').innerHTML=pack.items.filter(i=>i.category===category).map(i=>`<section class="box pack-card"><h2>${U.escape(i.title)}</h2><p class="small">${U.escape(i.step)}</p>${i.instruction?`<div class="notice">${U.escape(i.instruction)}</div>`:''}<pre class="pre">${U.escape(fill(i.prompt))}</pre><button class="btn primary" data-copy="${U.escape(i.id)}">${i.category==='15-second videos'?'Copy video prompt':'Copy this text'}</button>${i.caption?`<details class="mt16" open><summary>Your overlay text + caption</summary><pre class="pre">${U.escape(fill(i.caption))}</pre><button class="btn" data-caption="${U.escape(i.id)}">Copy overlay + caption</button></details>`:''}</section>`).join('');
 $('#packTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.category;render();});
 $('#packCards').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>U.copy(fill(pack.items.find(i=>i.id===b.dataset.copy).prompt),b));
 $('#packCards').querySelectorAll('[data-caption]').forEach(b=>b.onclick=()=>U.copy(fill(pack.items.find(i=>i.id===b.dataset.caption).caption),b));
}
try{let data;if(U.preview&&window.RBI_PREVIEW_PACK)data={pack:window.RBI_PREVIEW_PACK,telegramURL:''};else{if(!access)return;data=await U.api('bonus',access);}pack=data.pack;$('#packLocked').hidden=true;$('#packContents').hidden=false;
 if(data.telegramURL){$('#telegramButton').href=data.telegramURL;$('#telegramButton').hidden=false;}else $('#telegramPending').hidden=false;
 $('#packShop').addEventListener('input',render);$('#packCity').addEventListener('input',render);render();
}catch(e){U.setError($('#packError'),e.message);}
})();
