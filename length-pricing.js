(()=>{
  const $=id=>document.getElementById(id),seconds=$('videoSeconds'),slider=$('videoSecondsSlider'),preview=$('includePreview'),full=$('fullPayment'),link=$('requestVideo'),error=$('lengthError');
  if(!seconds||!slider||!preview||!link||!error)return;
  const money=n=>'$'+n.toLocaleString('en-US');
  const presets=[...document.querySelectorAll('[data-seconds]')];
  function update(){
    const raw=seconds.value.trim(),n=Number(raw);
    const valid=/^\d+$/.test(raw)&&Number.isSafeInteger(n)&&n>=30&&Number.isSafeInteger(n+5);
    error.hidden=valid;
    seconds.setAttribute('aria-invalid',String(!valid));
    seconds.setCustomValidity(valid?'':'Enter a whole number of seconds, at least 30.');
    if(!valid){
      error.textContent='Enter a whole number of seconds, at least 30.';
      link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.textContent='Choose at least 30 seconds';
      $('videoPriceLabel').textContent='Choose a valid length';$('videoPrice').textContent='—';$('previewPrice').textContent=preview.checked?'$5':'Not selected';$('videoTotal').textContent='—';$('firstPayment').textContent='—';
      presets.forEach(p=>p.setAttribute('aria-pressed','false'));return;
    }
    error.textContent='';link.removeAttribute('aria-disabled');
    slider.max=String(Math.max(180,n));slider.value=String(n);
    slider.setAttribute('aria-valuetext',n+' seconds, '+money(n)+' video price');
    presets.forEach(p=>p.setAttribute('aria-pressed',String(Number(p.dataset.seconds)===n)));
    const extra=preview.checked?5:0,total=n+extra;
    $('videoPriceLabel').textContent=n.toLocaleString('en-US')+' seconds × $1';$('videoPrice').textContent=money(n);$('previewPrice').textContent=preview.checked?'$5':'Not selected';$('videoTotal').textContent=money(total);
    $('firstPayment').textContent=preview.checked?'$5':money(n);
    $('totalLabel').textContent=preview.checked?'Total if you continue to the video':'Video total';
    $('paymentExplanation').textContent=preview.checked?'Start with the $5 preview. If you continue, the full '+money(n)+' video price is still due. The $5 is separate and not credited.':'Pay the full selected video price. No preview fee is added.';
    link.textContent=preview.checked?'Request $5 preview to start ↗':'Request full payment · '+money(n)+' ↗';
    const body="Hi ToonClipz, I'd like a "+n+'-second video for '+money(n)+'. '+(preview.checked?'I want to start with the separate $5 preview, not credited toward the video. First payment: $5. If I continue, the full video price of '+money(n)+' is still due. Combined total if I continue: '+money(total)+'.':'I want to pay in full for my selected length. No preview selected. Total: '+money(total)+'.')+' Please confirm my creative brief, availability and payment details.';
    link.href='mailto:rich.madeit3@gmail.com?subject='+encodeURIComponent('ToonClipz '+n+'-second video request')+'&body='+encodeURIComponent(body);
  }
  seconds.addEventListener('input',update);
  slider.addEventListener('input',()=>{seconds.value=slider.value;update();});
  preview.addEventListener('change',update);
  full?.addEventListener('change',update);
  presets.forEach(p=>p.addEventListener('click',()=>{seconds.value=p.dataset.seconds;update();}));
  link.addEventListener('click',e=>{if(link.getAttribute('aria-disabled')==='true'){e.preventDefault();seconds.focus();}});
  update();
})();
