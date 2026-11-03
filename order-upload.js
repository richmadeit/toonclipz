/* Private-bucket uploads: resume interrupted transfers and reuse finished files on retry. */
(()=>{
  const PHOTO_LIMIT=2*1024*1024;
  async function preparePhoto(file){
    if(file.size<=PHOTO_LIMIT||typeof Image==='undefined')return file;
    const url=URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
      const scale=Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
      return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified}):file;
    }catch{return file;}finally{URL.revokeObjectURL(url);}
  }
  window.toonclipzCreateUploader=({client,apiKey,onStatus=()=>{}})=>{
    const transfers=new Map();
    return async(file,kind,reference)=>{
      const key=JSON.stringify([reference,kind,file.name,file.size,file.lastModified||0]);
      let state=transfers.get(key);
      if(!state){
        onStatus(kind==='photo'?'Preparing your photo…':'Preparing your song…');
        const body=kind==='photo'?await preparePhoto(file):file;
        const suffix=(body.name.split('.').pop()||'file').replace(/[^a-z0-9]/ig,'').slice(0,6).toLowerCase();
        state={body,path:reference+'/'+crypto.randomUUID()+'/'+kind+'-'+crypto.randomUUID()+'.'+suffix,complete:false};transfers.set(key,state);
      }
      if(state.complete)return state.path;
      const label=kind==='photo'?'photo':'song';
      if(!window.tus?.Upload){
        onStatus('Uploading your '+label+'… Keep this page open.');
        const {error}=await client.storage.from('submissions').upload(state.path,state.body,{contentType:state.body.type||'application/octet-stream'});
        if(error)throw error;state.complete=true;return state.path;
      }
      return new Promise((resolve,reject)=>{
        state.resolve=resolve;state.reject=reject;
        if(!state.upload)state.upload=new window.tus.Upload(state.body,{
          endpoint:'https://molqlfdjlmnlkscecngz.storage.supabase.co/storage/v1/upload/resumable',
          headers:{authorization:'Bearer '+apiKey,apikey:apiKey,'x-upsert':'false'},
          chunkSize:6*1024*1024,uploadDataDuringCreation:false,
          retryDelays:[0,1500,3000,5000],timeout:600000,
          removeFingerprintOnSuccess:true,storeFingerprintForResuming:false,
          metadata:{bucketName:'submissions',objectName:state.path,contentType:state.body.type||'application/octet-stream',cacheControl:'3600'},
          onProgress(sent,total){onStatus('Uploading your '+label+'… '+Math.round(sent/total*100)+'%. Keep this page open.');},
          onShouldRetry(error,attempt,options){
            const code=error.originalResponse?.getStatus();
            if(code>=400&&code<500&&code!==408&&code!==409&&code!==423&&code!==429)return false;
            onStatus('Connection interrupted. Resuming your '+label+'…');return true;
          },
          onSuccess(){state.complete=true;state.resolve(state.path);},
          onError(error){state.reject(error);}
        });
        onStatus('Uploading your '+label+'… Keep this page open.');state.upload.start();
      });
    };
  };
})();
