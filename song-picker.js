(()=>{
  const $=id=>document.getElementById(id);
  const fileInput=$('song'),section=$('songSection');
  if(!fileInput||!section)return;
  const audio=$('songPreview'),slider=$('songStart'),startInput=$('songStartTime');
  const selection=$('songSelection'),confirm=$('confirmSongSection');
  const play=$('playSongSelection'),status=$('songPickerStatus');
  const CLIP_SECONDS=15;
  let objectUrl=null,duration=null,ready=false,playing=false,stopTimer=null;
  const tenth=n=>Math.round(n*10)/10;
  const format=n=>{
    const ticks=Math.round(n*10),minutes=Math.floor(ticks/600);
    const seconds=Math.floor(ticks%600/10).toString().padStart(2,'0');
    return minutes+':'+seconds+(ticks%10?'.'+ticks%10:'');
  };
  const parse=value=>{
    const s=value.trim();
    if(!/^\d+:\d{2}(?:\.\d)?$/.test(s))return null;
    const [m,seconds]=s.split(':').map(Number);
    const result=m*60+seconds;
    return seconds<60&&Number.isSafeInteger(Math.round(result*10))?tenth(result):null;
  };
  const maxStart=()=>duration===null?null:Math.max(0,Math.floor((duration-CLIP_SECONDS)*10)/10);
  function range(){
    const start=parse(startInput.value);
    if(start===null||maxStart()!==null&&start>maxStart())return null;
    return {start,end:duration===null?start+CLIP_SECONDS:Math.min(tenth(duration),tenth(start+CLIP_SECONDS))};
  }
  function stop(){
    clearTimeout(stopTimer);stopTimer=null;playing=false;audio.pause();
    play.textContent='▶ Listen to selection';
  }
  function render(){
    const selected=range();
    selection.textContent=selected?format(selected.start)+'–'+format(selected.end):'Enter a valid start time';
    confirm.disabled=!selected;
    play.disabled=!ready||!selected;
    if(selected){slider.value=String(selected.start);slider.setAttribute('aria-valuetext',selection.textContent);}
    startInput.setCustomValidity(selected?'':duration===null?'Enter a start time such as 0:43.':'Choose a start time from 0:00 to '+format(maxStart())+'.');
  }
  function changed(){stop();confirm.checked=false;render();}
  function reset(){
    stop();
    audio.removeAttribute('src');audio.load();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=null;duration=null;ready=false;
    slider.disabled=true;slider.max='0';slider.value='0';
    startInput.value='0:00';startInput.setCustomValidity('');
    confirm.checked=false;confirm.required=false;confirm.disabled=false;
    play.disabled=true;selection.textContent='0:00–0:15';$('songDuration').textContent='—';
  }
  fileInput.addEventListener('change',()=>{
    reset();
    const file=fileInput.files[0];section.hidden=!file;
    if(!file)return;
    confirm.required=true;
    status.textContent='Loading your song… You can also enter an exact start time below.';
    objectUrl=URL.createObjectURL(file);audio.src=objectUrl;audio.load();
  });
  audio.addEventListener('loadedmetadata',()=>{
    if(!objectUrl)return;
    if(!Number.isFinite(audio.duration)||audio.duration<=0){
      status.textContent='Preview unavailable for this file. Enter the exact start time below; you can still upload your song.';
      return;
    }
    duration=audio.duration;ready=true;slider.max=String(maxStart());slider.disabled=maxStart()===0;
    $('songDuration').textContent=format(duration);
    // Clamp a manually entered time if metadata arrives after the customer typed it.
    const start=parse(startInput.value);
    if(start!==null&&start>maxStart()){startInput.value=format(maxStart());confirm.checked=false;}
    if(duration<CLIP_SECONDS){status.textContent='This file is shorter than 15 seconds. Your preview will use the complete '+format(duration)+' track.';}
    else{status.textContent='Slide, listen, then confirm the exact '+CLIP_SECONDS+' seconds you want.';}
    render();
  });
  audio.addEventListener('error',()=>{
    if(!objectUrl)return;
    stop();ready=false;
    status.textContent='This browser cannot preview that file. Enter the exact start time below; you can still upload your song.';
    render();
  });
  slider.addEventListener('input',()=>{startInput.value=format(Number(slider.value));changed();});
  startInput.addEventListener('input',changed);
  startInput.addEventListener('blur',()=>{const value=parse(startInput.value);if(value!==null)startInput.value=format(value);});
  function armStop(){
    clearTimeout(stopTimer);
    const selected=range();
    if(!playing||!selected)return;
    stopTimer=setTimeout(stop,Math.max(0,(selected.end-audio.currentTime)/audio.playbackRate*1000));
  }
  play.addEventListener('click',async()=>{
    if(playing){stop();return;}
    const selected=range();if(!ready||!selected)return;
    audio.currentTime=selected.start;playing=true;play.textContent='Ⅱ Pause preview';
    try{await audio.play();if(playing)armStop();}
    catch{stop();status.textContent='Playback could not start. Try Listen again, or choose the exact start time below.';}
  });
  audio.addEventListener('timeupdate',()=>{const selected=range();if(playing&&selected&&audio.currentTime>=selected.end)stop();});
  audio.addEventListener('playing',armStop);
  audio.addEventListener('seeked',armStop);
  audio.addEventListener('waiting',()=>clearTimeout(stopTimer));
  audio.addEventListener('pause',()=>{clearTimeout(stopTimer);playing=false;play.textContent='▶ Listen to selection';});
  audio.addEventListener('ended',stop);
  window.toonclipzSongPicker={
    validate(){
      if(!fileInput.files[0])return '';
      if(!range()){startInput.focus();return startInput.validationMessage||'Enter the exact start time for your preview.';}
      if(!confirm.checked){confirm.focus();return 'Listen to your chosen section, then check “Yes, use this exact section” before sending.';}
      return '';
    },
    getSelection(){
      const selected=range();
      return fileInput.files[0]&&confirm.checked&&selected?{start:format(selected.start),end:format(selected.end)}:null;
    },
    destroy:reset
  };
})();
