import {createHash} from 'node:crypto';
import {limitedBytes, MAX_BYTES} from './free-video-validation.mjs';

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 250000;
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

export async function validatePhoto(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.size < 16 || file.size > MAX_PHOTO_BYTES) return {error:'photoSize'};
  // The browser converts the selected photo into a compact JPEG, removing source metadata.
  if (!/\.jpe?g$/i.test(file.name) || !['image/jpeg','application/octet-stream',''].includes(file.type)) return {error:'photoType'};
  const bytes=Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes[0]!==0xff || bytes[1]!==0xd8 || bytes[2]!==0xff || bytes.at(-2)!==0xff || bytes.at(-1)!==0xd9) return {error:'photoType'};
  // Require a bounded JPEG frame and a scan, not just leading/trailing magic bytes.
  let offset=2,frame=false,scan=false;
  while(offset<bytes.length-2){
    if(bytes[offset++]!==0xff)return {error:'photoType'};
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xda){scan=frame;break;}
    if(offset+2>bytes.length)return {error:'photoType'};
    const length=bytes.readUInt16BE(offset);
    if(length<2 || offset+length>bytes.length)return {error:'photoType'};
    if([0xc0,0xc1,0xc2].includes(marker)){
      if(length<8)return {error:'photoType'};
      const height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5);
      if(width<1||height<1||width>2000||height>2000)return {error:'photoType'};
      frame=true;
    }
    offset+=length;
  }
  if(!frame||!scan)return {error:'photoType'};
  return {value:{bytes,descriptor:{name:'reference.jpg',type:'image/jpeg',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}}};
}
export async function multipartInput(request) {
  const bytes=await limitedBytes(request,MAX_AUDIO_BYTES+MAX_PHOTO_BYTES+MAX_BYTES);
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')}}).formData();
  const body=Object.create(null);let file=null,photoFile=null;const keys=new Set();
  for(const [key,value] of form.entries()) {
    if(keys.has(key)) throw new Error('invalid_request');
    keys.add(key);
    if(key==='audio' || key==='photo') {
      if(typeof value==='string') throw new Error('invalid_request');
      if(key==='audio')file=value;else photoFile=value;
    } else { if(typeof value!=='string' || value.length>2048) throw new Error('invalid_request'); body[key]=value; }
  }
  body.rightsConsent=body.rightsConsent==='true';
  const photo=photoFile?.size ? await validatePhoto(photoFile) : {value:null};
  if(photo.error)return {error:photo.error};
  const audio=file?.size ? await validateAudio(file) : {value:null};
  if(audio.error)return {error:audio.error};
  return {body,audio:audio.value,photo:photo.value};
}
