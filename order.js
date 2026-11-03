(()=>{
  const form=document.querySelector('#materialsForm');
  if(!form)return;
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search);
  const getDuration=ref=>{const match=ref.match(/^TC-(?:D)?(15|30|60|180)-/);return match?Number(match[1]):null;};
  const reference=(qs.get('ref')||'').trim().slice(0,80);
  if(reference)$('orderRef').value=reference;
  const isDeposit=()=>/^TC-D(?:30|60|180)?-/.test($('orderRef').value);
  const visualStyle=$('visualStyle'),portfolio=window.toonclipzPortfolio;
  if(visualStyle&&portfolio)visualStyle.value=portfolio.read(reference)||'';
  const syncAnimalOptions=()=>{if($('animalOptions'))$('animalOptions').hidden=visualStyle?.value!=='characters';};
  visualStyle?.addEventListener('change',syncAnimalOptions);syncAnimalOptions();
  $('pageTitle').textContent='Send your song and photos';
  $('pageIntro').textContent='Send your song, choose your visual style and add your creative idea. Want an animal artist? Choose Cinematic Animal Characters below; no face photo needed. Use your checkout reference so we can match your files to your paid package.';
  $('photoLabel').textContent='Your photos (optional if sending song)';
  $('orderRef').required=true;
  $('orderRefHelp').textContent='Use the order reference from your Stripe confirmation. Keep the same reference for any additional files.';
  $('materialsSubmit').textContent='Send my files';
  function updatePackageHint(){if(isDeposit()){$('songSectionHelp').textContent='Choose your package in your notes: 30 seconds ($50 total), 1 minute ($90), or 3 minutes ($250). Your $5 deposit counts toward it. Choose your exact preview section above, then add one outfit and one stage idea here.';return;}const full=getDuration($('orderRef').value)===180;$('songSectionHelp').textContent=full?'For your full video, upload the complete song and choose the section you want for the initial preview above. Tell us your scene ideas and outfit. Songs over 3 minutes are $100 per additional minute, arranged by email.':'Choose your exact 15-second preview section above. Include your scene idea and outfit reference here.';}
  $('orderRef').addEventListener('input',()=>{$('orderRef').value=$('orderRef').value.replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);updatePackageHint();});
  updatePackageHint();
  const apiKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHFsZmRqbG1ubGtzY2Vjbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODEzNjMsImV4cCI6MjA5MzE1NzM2M30._CR9A4H7-E7CYzIWdEO4PgRcCgBcORP2wAZqXrXE4Ec';
  const supabase=window.supabase?.createClient('https://molqlfdjlmnlkscecngz.supabase.co',apiKey,{global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(String(url).includes('/storage/')?600000:30000)})}});
  const status=$('uploadStatus');
  const transfer=window.toonclipzCreateUploader?.({client:supabase,apiKey,onStatus:message=>{status.textContent=message;}});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const picker=window.toonclipzSongPicker;
    const selectionError=picker?.validate();
    if(selectionError){status.textContent=selectionError;return;}
    if(!form.reportValidity())return;
    const photos=Array.from($('photos').files),song=$('song').files[0];
    const selectedSection=picker?.getSelection();
    if(song&&!selectedSection){status.textContent='Choose and confirm your 15-second song section above. If the selector is missing, reload this page.';return;}
    if(!photos.length&&!song){status.textContent='Add a photo or your song to continue.';return}
    if(photos.length>5||photos.some(f=>!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>10*1048576)){status.textContent='Choose up to five JPG, PNG or WebP photos, each under 10 MB.';return}
    if(song&&(!(/^(audio|video)\//.test(song.type)||/\.(mp3|m4a|wav|aac|aiff|flac|mp4|mov|m4v)$/i.test(song.name))||song.size>50*1048576)){status.textContent='Choose an audio file or screen recording under 50 MB.';return}
    if(!supabase){status.textContent='Upload service unavailable. Please reload this page and retry.';return}
    const id=$('orderRef').value.trim();
    if(!id||/[^a-zA-Z0-9-]/.test(id)){status.textContent='Enter the order reference from your Stripe confirmation.';return;}
    const duration=getDuration(id);
    const button=$('materialsSubmit');button.disabled=true;
    status.textContent='Uploading your files… Keep this page open.';
    const uploaded=[];
    try{
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
      const contact='Email: '+clean($('email').value)+' | Requested look: '+preferredStyle+(visualStyle?.value==='characters'?' | Animal artist: '+clean($('animalChoice')?.value||'Help me choose'):'')+' | Artists requested: '+artistCount+(artistCount!=='1'?' (custom quote required; base package includes 1)':' (included)')+' | Source: toonclipz | Offer: '+(isDeposit()?'$5 DEPOSIT MATERIALS - confirm deposit in Stripe; preview only until balance is paid':'MATERIALS UPLOAD - confirm Stripe payment before production')+' | Requested duration: '+(duration===180?'up to 180':duration||'confirm paid package')+' seconds | Payment: UNVERIFIED - check Stripe before production | Materials: '+photos.length+' photos; song '+(song?'uploaded':'pending')+(selectedSection?' | Confirmed preview section: '+selectedSection.start+' to '+selectedSection.end:'')+' | Public showcase permission: NO | Creative idea: '+(clean($('notes').value)||'ToonClipz directs');
      status.textContent='Saving your order details…';
      const {error}=await supabase.from('submissions').insert({ref:id,artist_name:clean($('artist').value)||'Artist',contact,photo_paths:paths,song_path:songPath||'',song_url:null,start_time:selectedSection?.start||'',end_time:selectedSection?.end||'',style:'realistic'});
      if(error)throw error;
      window.toonclipzActivity?.('details_saved');
      form.hidden=true;
      $('uploadDone').hidden=false;
      $('uploadRef').textContent=id;
      $('doneText').textContent='Your files are in.'+(selectedSection?' Your confirmed preview section is '+selectedSection.start+'–'+selectedSection.end+'.':'')+' We will match them to your order reference. If you still need to send more files, use the same reference when you return.';
      picker?.destroy();
      $('uploadDone').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){
      window.toonclipzActivity?.('form_error');
      status.textContent='We could not finish saving your files. Your selections are still here. Tap Send my files to resume. If it still fails, reply to our email with your photos and song, or email rich.madeit3@gmail.com and include reference '+id+'.';
      console.warn('Upload incomplete',err);
      button.disabled=false;
    }
  });
})();
