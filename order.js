(()=>{
  const checkout='https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04';
  const ref=()=> 'RMI-'+Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
  const pay=document.querySelector('#payNow');
  if(pay){
    const u=new URL(checkout);u.searchParams.set('client_reference_id',ref());
    pay.href=u.href;
  }
  const form=document.querySelector('#materialsForm');
  if(!form)return;
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search);
  const preview=qs.get('mode')==='preview';
  const reference=(qs.get('ref')||'').trim().slice(0,80);
  if(reference)$('orderRef').value=reference;
  $('pageTitle').textContent=preview?'See your ToonClipz look first':'Send your photos or song';
  $('pageIntro').textContent=preview?'Send one clear photo. We will create a still starting-frame preview for you to review before payment. We will not make a video preview.':'Upload your song, your photos, or both. If you paid first, include your order reference from the Stripe confirmation. You can send the remaining files later.';
  $('photoLabel').textContent=preview?'Your photo (required for preview)':'Your photos (optional if sending song)';
  $('orderRef').required=false;
  $('orderRefHelp').textContent=preview?'If you already have an order reference, add it here.':'Paid already? Use the reference from your Stripe confirmation. If you started in DMs, we will create a reference for these files.';
  $('materialsSubmit').textContent=preview?'Request my photo preview':'Send my files';
  $('orderRef').addEventListener('input',()=>{$('orderRef').value=$('orderRef').value.replace(/[^a-zA-Z0-9-]/g,'').slice(0,80)});
  const supabase=window.supabase?.createClient('https://molqlfdjlmnlkscecngz.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHFsZmRqbG1ubGtzY2Vjbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODEzNjMsImV4cCI6MjA5MzE1NzM2M30._CR9A4H7-E7CYzIWdEO4PgRcCgBcORP2wAZqXrXE4Ec',{global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(String(url).includes('/storage/')?120000:20000)})}});
  const status=$('uploadStatus');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const photos=Array.from($('photos').files),song=$('song').files[0];
    if(preview&&!photos.length){status.textContent='Add at least one clear photo for a preview.';return}
    if(!photos.length&&!song){status.textContent='Add a photo or your song to continue.';return}
    if(photos.length>5||photos.some(f=>!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>10*1048576)){status.textContent='Choose up to five JPG, PNG or WebP photos, each under 10 MB.';return}
    if(song&&(!(/^(audio|video)\//.test(song.type)||/\.(mp3|m4a|wav|aac|aiff|flac|mp4|mov|m4v)$/i.test(song.name))||song.size>50*1048576)){status.textContent='Choose an audio file or screen recording under 50 MB.';return}
    if(!supabase){status.textContent='Upload service unavailable. Please retry or message ToonClipz.';return}
    const id=$('orderRef').value.trim()||ref();
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
      const contact='Email: '+clean($('email').value)+' | Requested look: ToonClipz signature cartoon (DDG example look) | Source: toonclipz | Offer: '+(preview?'STILL PHOTO PREVIEW REQUEST - no payment yet':'MATERIALS UPLOAD - confirm Stripe payment before production')+' | Payment: UNVERIFIED - check Stripe before production | Materials: '+photos.length+' photos; song '+(song?'uploaded':'pending')+' | Public showcase permission: NO | Creative idea: '+(clean($('notes').value)||'ToonClipz directs');
      const {error}=await supabase.from('submissions').insert({ref:id,artist_name:clean($('artist').value)||'Artist',contact,mood:clean($('notes').value)||'ToonClipz stage performance',photo_paths:paths,song_path:songPath,song_url:null,start_time:'',end_time:'',style:'realistic'});
      if(error)throw error;
      form.hidden=true;
      $('uploadDone').hidden=false;
      $('uploadRef').textContent=id;
      $('doneText').textContent=preview?'Your photo is in. We will review it and send a still ToonClipz look to your email. There is no charge for the still preview.':'Your files are in. We will match them to your order reference. If you still need to send more files, use the same reference when you return.';
      if(preview){const payment=new URL(checkout);payment.searchParams.set('client_reference_id',id);$('donePay').href=payment.href;$('donePay').hidden=false}
      $('uploadDone').scrollIntoView({behavior:'smooth',block:'center'});
      if(preview&&typeof window.rmiTrackSuccessfulLead==='function')window.rmiTrackSuccessfulLead(id);
    }catch(err){
      status.textContent='We could not finish saving your files. Please retry or message ToonClipz with your reference. '+(uploaded.length?'Some files may have uploaded; use the same reference.':'');
      console.warn('Upload incomplete',err);
      button.disabled=false;
    }
  });
})();
