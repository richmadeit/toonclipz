(()=>{
  const form=document.querySelector('#materialsForm');
  if(!form)return;
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search);
  const getDuration=ref=>{const match=ref.match(/^TC-(15|30|60|180)-/);return match?Number(match[1]):null;};
  const reference=(qs.get('ref')||'').trim().slice(0,80);
  if(reference)$('orderRef').value=reference;
  const visualStyle=$('visualStyle'),portfolio=window.toonclipzPortfolio;
  if(visualStyle&&portfolio)visualStyle.value=portfolio.read(reference)||'';
  $('pageTitle').textContent='Send your song and photos';
  $('pageIntro').textContent='Upload your photos and song, enter the exact song start time, and add your creative idea. Use your checkout reference so we can match your files to your paid package.';
  $('photoLabel').textContent='Your photos (optional if sending song)';
  $('orderRef').required=true;
  $('orderRefHelp').textContent='Use the order reference from your Stripe confirmation. Keep the same reference for any additional files.';
  $('materialsSubmit').textContent='Send my files';
  function updatePackageHint(){const full=getDuration($('orderRef').value)===180;$('songSectionHelp').textContent=full?'For your full video, upload the complete song and include its total length. Tell us your scene ideas and outfit. Songs over 3 minutes are $100 per additional minute, arranged by email.':'Enter the exact song timestamp where your clip should start. Include your scene idea and outfit reference.';}
  $('orderRef').addEventListener('input',()=>{$('orderRef').value=$('orderRef').value.replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);updatePackageHint();});
  updatePackageHint();
  const supabase=window.supabase?.createClient('https://molqlfdjlmnlkscecngz.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHFsZmRqbG1ubGtzY2Vjbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODEzNjMsImV4cCI6MjA5MzE1NzM2M30._CR9A4H7-E7CYzIWdEO4PgRcCgBcORP2wAZqXrXE4Ec',{global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(String(url).includes('/storage/')?120000:20000)})}});
  const status=$('uploadStatus');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const photos=Array.from($('photos').files),song=$('song').files[0];
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
      const folder=id+'/'+crypto.randomUUID();
      async function upload(file,kind){
        const suffix=(file.name.split('.').pop()||'file').replace(/[^a-z0-9]/ig,'').slice(0,6).toLowerCase();
        const path=folder+'/'+kind+'-'+crypto.randomUUID()+'.'+suffix;
        const {error}=await supabase.storage.from('submissions').upload(path,file,{contentType:file.type||'application/octet-stream'});
        if(error)throw error;
        uploaded.push(path);return path;
      }
      const paths=[];
      for(const photo of photos)paths.push(await upload(photo,'photo'));
      const songPath=song?await upload(song,'song'):null;
      const clean=x=>x.trim().replace(/[\r\n|]+/g,' ').slice(0,500);
      const preferredStyle=portfolio?.styles[visualStyle?.value]||'ToonClipz directs';
      const contact='Email: '+clean($('email').value)+' | Requested look: '+preferredStyle+' | Source: toonclipz | Offer: '+'MATERIALS UPLOAD - confirm Stripe payment before production'+' | Requested duration: '+(duration===180?'up to 180':duration||'confirm paid package')+' seconds | Payment: UNVERIFIED - check Stripe before production | Materials: '+photos.length+' photos; song '+(song?'uploaded':'pending')+' | Public showcase permission: NO | Creative idea: '+(clean($('notes').value)||'ToonClipz directs');
      const {error}=await supabase.from('submissions').insert({ref:id,artist_name:clean($('artist').value)||'Artist',contact,photo_paths:paths,song_path:songPath||'',song_url:null,start_time:'',end_time:'',style:'realistic'});
      if(error)throw error;
      window.toonclipzActivity?.('details_saved');
      form.hidden=true;
      $('uploadDone').hidden=false;
      $('uploadRef').textContent=id;
      $('doneText').textContent='Your files are in. We will match them to your order reference. If you still need to send more files, use the same reference when you return.';
      $('uploadDone').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){
      window.toonclipzActivity?.('form_error');
      status.textContent='We could not finish saving your files. Please retry using the same reference. '+(uploaded.length?'Some files may have uploaded; use the same reference.':'');
      console.warn('Upload incomplete',err);
      button.disabled=false;
    }
  });
})();
