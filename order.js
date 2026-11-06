(()=>{
  const form=document.querySelector('#materialsForm');
  if(!form)return;
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search);
  if(qs.get('embedded')==='1')document.body?.classList?.add('embedded-upload');
  const getDuration=ref=>{const match=ref.match(/^TC-(?:D)?(15|30|60|180)-/);return match?Number(match[1]):null;};
  const depositTier=qs.get('checkout')==='deposit'&&['30','60','180'].includes(qs.get('tier'))?qs.get('tier'):null;
  const newDeposit=!!depositTier;
  let reference=(qs.get('ref')||'').trim().slice(0,80);
  if(newDeposit){
    const key='toonclipz.deposit-draft.'+depositTier;
    try{reference=sessionStorage.getItem(key)||'';}catch{reference='';}
    if(!new RegExp('^TC-D'+depositTier+'-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$').test(reference))reference='TC-D'+depositTier+'-'+crypto.randomUUID();
    try{sessionStorage.setItem(key,reference);}catch{}
    $('orderRef').readOnly=true;
  }
  if(reference)$('orderRef').value=reference;
  const isDeposit=()=>/^TC-D(?:30|60|180)?-/.test($('orderRef').value);
  const visualStyle=$('visualStyle'),portfolio=window.toonclipzPortfolio;
  if(visualStyle&&portfolio)visualStyle.value=portfolio.read(reference)||'';
  const syncAnimalOptions=()=>{if($('animalOptions'))$('animalOptions').hidden=visualStyle?.value!=='characters';};
  visualStyle?.addEventListener('change',syncAnimalOptions);syncAnimalOptions();
  $('pageTitle').textContent='Send your song and photos';
  $('pageIntro').textContent='Send an audio file, a song link, or a screen recording with sound. Add your photo and choose the exact part of the song. Your order reference connects these details to your payment.';
  $('photoLabel').textContent='Your photos (optional if sending song)';
  $('orderRef').required=true;
  $('orderRefHelp').textContent='Use the order reference from your Stripe confirmation. Keep the same reference for any additional files.';
  $('materialsSubmit').textContent='Send my materials';
  if(newDeposit){
    $('pageTitle').textContent='Send your materials, then pay $5';
    $('pageIntro').textContent='Step 1: add your song, photo and preview start time. Step 2: pay your $5 deposit at secure Stripe checkout. We save your materials first and credit the $5 toward your '+depositTier+'-second package.';
    $('photoLabel').textContent='Your photos (required for a video of you)';
    $('orderRefHelp').textContent='Already filled in. This reference will connect your materials to your $5 deposit.';
    $('materialsSubmit').textContent='Save materials & pay $5';
  }
  function updatePackageHint(){if(isDeposit()){$('songSectionHelp').textContent='Choose your package in your notes: 30 seconds ($50 total), 1 minute ($90), or 3 minutes ($250). Your $5 deposit counts toward it. Choose your exact preview section above, then add one outfit and one stage idea here.';return;}const full=getDuration($('orderRef').value)===180;$('songSectionHelp').textContent=full?'For your full video, upload the complete song and choose the section you want for the initial preview above. Tell us your scene ideas and outfit. Songs over 3 minutes are $100 per additional minute, arranged by email.':'Choose your exact 15-second preview section above. Include your scene idea and outfit reference here.';}
  $('orderRef').addEventListener('input',()=>{$('orderRef').value=$('orderRef').value.replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);updatePackageHint();});
  updatePackageHint();
  const apiKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHFsZmRqbG1ubGtzY2Vjbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODEzNjMsImV4cCI6MjA5MzE1NzM2M30._CR9A4H7-E7CYzIWdEO4PgRcCgBcORP2wAZqXrXE4Ec';
  const supabase=window.supabase?.createClient('https://molqlfdjlmnlkscecngz.supabase.co',apiKey,{global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(String(url).includes('/storage/')?600000:30000)})}});
  const status=$('uploadStatus');
  const songHosts=new Set(['youtube.com','www.youtube.com','music.youtube.com','youtu.be','soundcloud.com','www.soundcloud.com','on.soundcloud.com','open.spotify.com','music.apple.com','audiomack.com','www.audiomack.com','drive.google.com','www.dropbox.com','dropbox.com']);
  function cleanSongUrl(raw){
    if(!raw||raw.length>2048||/[\s\\\u0000-\u001f\u007f]/.test(raw))return null;
    try{const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.port||!songHosts.has(url.hostname)||url.pathname==='/')return null;return url.href;}catch{return null;}
  }
  const transfer=window.toonclipzCreateUploader?.({client:supabase,apiKey,onStatus:message=>{status.textContent=message;}});
  let submitting=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(submitting)return;
    const rawSongUrl=($('songUrl')?.value||'').trim();
    const songUrl=cleanSongUrl(rawSongUrl);
    if(rawSongUrl&&!songUrl){status.textContent='Paste a full HTTPS song link from YouTube, SoundCloud, Spotify, Apple Music, Audiomack, Google Drive or Dropbox, or upload your file below.';return;}
    const picker=window.toonclipzSongPicker;
    const selectionError=picker?.validate();
    if(selectionError){status.textContent=selectionError;return;}
    if(!form.reportValidity())return;
    const photos=Array.from($('photos').files),song=$('song').files[0];
    if(newDeposit&&!song&&!songUrl){status.textContent='Add an audio file, a screen recording with sound, or a song link before continuing to your $5 deposit.';return;}
    if(newDeposit&&!photos.length&&visualStyle?.value!=='characters'){status.textContent='Add at least one clear photo for your video. For a new animal artist instead, choose Cinematic Animal Characters below.';return;}
    const selectedSection=picker?.getSelection();
    if((song||songUrl)&&!selectedSection){status.textContent='Choose and confirm your 15-second song section above. If the selector is missing, reload this page.';return;}
    if(!photos.length&&!song&&!songUrl){status.textContent='Add a photo, audio file, screen recording or song link to continue.';return}
    if(photos.length>5||photos.some(f=>!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size<=0||f.size>10*1048576)){status.textContent='Choose up to five non-empty JPG, PNG or WebP photos, each under 10 MB.';return}
    if(song&&(!(/^(audio|video)\//.test(song.type)||/\.(mp3|m4a|wav|aac|aiff|flac|mp4|mov|m4v)$/i.test(song.name))||song.size<=0||song.size>50*1048576)){status.textContent='Choose a non-empty audio file or screen recording under 50 MB. For a larger file, paste a song or shared-file link instead.';return}
    if(!supabase){status.textContent='Upload service unavailable. Please reload this page and retry.';return}
    const id=$('orderRef').value.trim();
    if(!id||/[^a-zA-Z0-9-]/.test(id)){status.textContent='Enter the order reference from your Stripe confirmation.';return;}
    const duration=getDuration(id);
    const button=$('materialsSubmit');button.disabled=true;submitting=true;
    status.textContent='Uploading your files… Keep this page open.';
    const uploaded=[];
    try{
      if(newDeposit){
        status.textContent='Checking secure checkout availability…';
        const availability=await fetch('/.netlify/functions/deposit-order',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
        const available=await availability.json();
        if(!availability.ok||available.available!==true)throw new Error('Checkout preparation is temporarily unavailable.');
      }
      async function upload(file,kind){
        if(!transfer)throw new Error('Upload helper unavailable');
        const path=await transfer(file,kind,id);uploaded.push(path);return path;
      }
      const paths=[];
      for(const photo of photos)paths.push(await upload(photo,'photo'));
      const songPath=song?await upload(song,'song'):null;
      const clean=x=>x.trim().replace(/[\r\n|]+/g,' ').slice(0,500);
      const artistCount=['1','2','3','4','5+'].includes($('artistCount')?.value)?$('artistCount').value:'1';
      const preferredStyle=portfolio?.styles[visualStyle?.value]||'ToonClipz directs';
      const contact='Email: '+clean($('email').value)+' | Requested look: '+preferredStyle+(visualStyle?.value==='characters'?' | Animal artist: '+clean($('animalChoice')?.value||'Help me choose'):'')+' | Artists requested: '+artistCount+(artistCount!=='1'?' (custom quote required; base package includes 1)':' (included)')+' | Source: toonclipz | Offer: '+(isDeposit()?'$5 DEPOSIT MATERIALS - confirm deposit in Stripe; preview only until balance is paid':'MATERIALS UPLOAD - confirm Stripe payment before production')+' | Requested duration: '+(duration===180?'up to 180':duration||'confirm paid package')+' seconds | Payment: UNVERIFIED - check Stripe before production | Materials: '+photos.length+' photos; song '+(song?'uploaded':songUrl?'link provided':'pending')+(selectedSection?' | Confirmed preview section: '+selectedSection.start+' to '+selectedSection.end:'')+' | Public showcase permission: NO | Creative idea: '+(clean($('notes').value)||'ToonClipz directs');
      status.textContent='Saving your order details…';
      const materials={ref:id,artist_name:clean($('artist').value)||'Artist',contact,photo_paths:paths,song_path:songPath||'',song_url:songUrl,start_time:selectedSection?.start||'',end_time:selectedSection?.end||'',style:'realistic'};
      let checkoutUrl;
      if(newDeposit){
        const response=await fetch('/.netlify/functions/deposit-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...materials,email:$('email').value.trim(),visual_style:visualStyle?.value||''}),signal:AbortSignal.timeout(30000)});
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.error||'Unable to save your materials.');
        const checkout=new URL(result.checkoutUrl);
        if(result.ref!==id||checkout.origin!=='https://buy.stripe.com'||checkout.pathname!=='/eVqdRabZ33KTdMjfDJ2wU0b'||checkout.searchParams.get('client_reference_id')!==id)throw new Error('Checkout could not be linked to your materials.');
        checkoutUrl=checkout.href;
      }else{
        const {error}=await supabase.from('submissions').insert(materials);
        if(error)throw error;
      }
      window.toonclipzActivity?.('details_saved');
      form.hidden=true;
      $('uploadDone').hidden=false;
      $('uploadRef').textContent=id;
      if(newDeposit){
        try{sessionStorage.removeItem('toonclipz.deposit-draft.'+depositTier);}catch{}
        $('doneTitle').textContent='Materials saved. Finish your $5 deposit.';
        $('doneText').textContent='Your materials are saved under this reference. Opening secure Stripe checkout for your $5 deposit. Your preview is ready the same day we receive your $5 deposit and all required materials. Your full video takes 24–72 hours after the remaining payment and all required materials are received.';
        $('continuePayment').href=checkoutUrl;$('continuePayment').hidden=false;
        window.toonclipzActivity?.('checkout');
        try{location.assign(checkoutUrl);}catch{}
        return;
      }
      $('doneText').textContent='Your materials are in.'+(selectedSection?' Your confirmed preview section is '+selectedSection.start+'–'+selectedSection.end+'.':'')+(songUrl?' We will review your song link.':'')+' We will match them to your order reference. If you still need to send more files, use the same reference when you return.';
      picker?.destroy();
      $('uploadDone').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){
      window.toonclipzActivity?.('form_error');
      status.textContent='We could not finish saving your materials. Your selections are still here. Tap Send my materials to resume. If it still fails, reply to our email with your photos and song, or email rich.madeit3@gmail.com and include reference '+id+'.';
      console.warn('Upload incomplete',err);
      button.disabled=false;submitting=false;
    }
  });
})();

