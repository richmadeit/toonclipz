import {createHash} from 'node:crypto';
import {limitedBytes, MAX_BYTES} from './free-video-validation.mjs';

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const formats = {
  mp3: ['audio/mpeg','audio/mp3'], wav: ['audio/wav','audio/wave','audio/x-wav'],
  m4a: ['audio/mp4','audio/x-m4a','video/mp4'], aac: ['audio/aac','audio/x-aac'],
  ogg: ['audio/ogg','application/ogg'], flac: ['audio/flac','audio/x-flac']
};
export async function validateAudio(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.size < 16 || file.size > MAX_AUDIO_BYTES) return {error:'audioSize'};
  const ext = String(file.name).toLowerCase().split('.').pop();
  if (!formats[ext]) return {error:'audioType'};
  const mime=String(file.type||'').toLowerCase();
  if (mime && mime !== 'application/octet-stream' && !formats[ext].includes(mime)) return {error:'audioType'};
  const bytes=Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) return {error:'audioType'};
  const ascii=(start,end)=>bytes.toString('ascii',start,end);
  let valid=false;
  if(ext==='mp3') valid=ascii(0,3)==='ID3' || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0 && (bytes[1]&0x06)!==0 && (bytes[2]&0xf0)!==0xf0);
  if(ext==='wav') valid=bytes.length>=44 && ascii(0,4)==='RIFF' && ascii(8,12)==='WAVE' && bytes.readUInt32LE(4)+8<=bytes.length;
  if(ext==='m4a') valid=ascii(4,8)==='ftyp' && /^(M4A |M4B |isom|iso2|mp41|mp42|qt  )$/.test(ascii(8,12));
  if(ext==='aac') valid=bytes[0]===0xff && (bytes[1]&0xf6)===0xf0;
  if(ext==='ogg') valid=ascii(0,4)==='OggS' && bytes[4]===0;
  if(ext==='flac') valid=ascii(0,4)==='fLaC';
  if(!valid) return {error:'audioType'};
  return {value:{bytes, descriptor:{name:'song.'+ext,type:formats[ext][0],size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}}};
}

export async function multipartInput(request) {
  const bytes=await limitedBytes(request,MAX_AUDIO_BYTES+MAX_BYTES);
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')}}).formData();
  const body=Object.create(null);let file=null;const keys=new Set();
  for(const [key,value] of form.entries()) {
    if(keys.has(key)) throw new Error('invalid_request');
    keys.add(key);
    if(key==='audio') { if(typeof value==='string') throw new Error('invalid_request'); file=value; }
    else { if(typeof value!=='string' || value.length>2048) throw new Error('invalid_request'); body[key]=value; }
  }
  body.rightsConsent=body.rightsConsent==='true';
  if(!file || file.size===0) return {body,audio:null};
  const audio=await validateAudio(file);
  if(audio.error) return {error:audio.error};
  return {body,audio:audio.value};
}
