(() => {
  'use strict';
  const form = document.querySelector('#submission-form');
  const fields = document.querySelector('#form-fields');
  const availability = document.querySelector('#availability');
  const result = document.querySelector('#form-result');
  const button = document.querySelector('#submit-button');
  const endpoint = '/.netlify/functions/free-video-submit';
  let ready = false, busy = false, completed = false, requestId = null, fingerprint = null, audioRevision = 0;
  const audioInput=form.elements.audio;
  const removeAudio=document.querySelector('#remove-audio');
  const updateAudio=()=>{
    audioRevision++;
    const file=audioInput.files[0];
    document.querySelector('#audio-picked').textContent=file ? `${file.name} · ${(file.size/1024/1024).toFixed(1)} MB selected` : 'Upload audio or add a link. You only need one.';
    removeAudio.hidden=!file;
  };
  audioInput.addEventListener('change',updateAudio);
  removeAudio.addEventListener('click',()=>{audioInput.value='';updateAudio();});
  const format = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const updateSegment = () => {
    const raw = form.elements.startTime.value;
    const valid = /^\d{1,3}:[0-5]\d$/.test(raw);
    const [m,s] = raw.split(':').map(Number);
    document.querySelector('#segment').textContent = valid ? `${format(m*60+s)} → ${format(m*60+s+15)}` : 'Use minutes:seconds';
  };
  form.elements.startTime.addEventListener('input', updateSegment);
  const messages = {
    artistName: 'Enter an artist name, up to 80 characters.',
    email: 'Enter a valid contact email.',
    songUrl: 'Use a full https:// song link from one of the listed services. Remove any # fragment or password from the link.',
    startTime: 'Enter a start time in minutes:seconds, such as 0:45.',
    rightsConsent: 'Confirm you have permission to share this music.',
    audioSize: 'Choose an audio file up to 4 MB, or paste a song link instead.',
    audioType: 'That file is not a supported audio file. Choose MP3, WAV, M4A, AAC, OGG or FLAC.',
    invalid_request: 'Check the form and try again.'
  };
  const showResult = (text, success = false) => {
    result.textContent = text;
    result.classList.toggle('success', success);
    result.hidden = false;
    result.focus();
  };
  async function availabilityCheck() {
    try {
      const response = await fetch(endpoint, {cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000)});
      const data = response.ok ? await response.json() : {};
      ready = data.enabled === true && typeof crypto.randomUUID === 'function';
    } catch { ready = false; }
    fields.disabled = !ready;
    availability.textContent = ready ? 'Submissions are open for consideration. One submission per email per hour.' : 'Submissions are not open yet. The form is shown for review; nothing can be sent right now.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy || completed || !form.reportValidity()) return;
    const audioFile=audioInput.files[0];
    if(!audioFile && !form.elements.songUrl.value.trim()) {showResult('Upload audio or paste a song link. You only need one.');return;}
    if(audioFile && (audioFile.size<16 || audioFile.size>4*1024*1024)) {showResult(messages.audioSize);return;}
    if(audioFile && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(audioFile.name)) {showResult(messages.audioType);return;}
    const payload = {
      artistName: form.elements.artistName.value.trim(), email: form.elements.email.value.trim(),
      songUrl: form.elements.songUrl.value.trim(), startTime: form.elements.startTime.value.trim(),
      rightsConsent: form.elements.rightsConsent.checked, website: form.elements.website.value
    };
    const current = JSON.stringify({...payload,audio:audioFile ? [audioFile.name,audioFile.size,audioFile.lastModified,audioRevision] : null});
    if (fingerprint !== current) { requestId = crypto.randomUUID(); fingerprint = current; }
    busy = true; fields.disabled = true; button.textContent = audioFile ? 'Uploading audio…' : 'Sending…'; result.hidden = true;
    try {
      let body=JSON.stringify({...payload,requestId});
      let headers={'Content-Type':'application/json'};
      if(audioFile){
        body=new FormData();
        for(const [key,value] of Object.entries({...payload,requestId})) body.append(key,String(value));
        body.append('audio',audioFile);
        headers={}; // Browser sets the required multipart boundary.
      }
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', headers, body, signal: AbortSignal.timeout(45000)
      });
      let data = {};
      try { data = await response.json(); } catch { /* Platform rate limiting can return HTML. */ }
      if (response.status === 201 && data.status === 'received' && data.reference === requestId) {
        completed = true;
        availability.textContent = 'Submission received.';
        button.textContent = 'Submitted';
        showResult('Your song is in for consideration. This is not a selection or a delivery promise. If selected, ToonClipz can contact you at the email you provided. Reference: ' + data.reference, true);
      } else if (response.status === 429) {
        showResult('Please wait before submitting again. Only one submission per email per hour is accepted, and shared networks have a short submission limit.');
      } else if (response.status === 400) {
        showResult(messages[data.field] || messages.invalid_request);
      } else if (response.status === 413) {
        showResult(messages.audioSize);
      } else if (response.status === 409) {
        showResult('This request was already used for different details. Reload to start a new submission.');
      } else {
        showResult('We could not confirm your submission. Your details are still here. Try again with the same details; a retry will not create a duplicate.');
      }
    } catch {
      showResult('We could not confirm your submission. Your details are still here. Try again with the same details; a retry will not create a duplicate.');
    } finally {
      busy = false;
      fields.disabled = completed;
      if (!completed) button.innerHTML = 'Submit my music for free <span aria-hidden="true">↗</span>';
    }
  });
  availabilityCheck();
})();
