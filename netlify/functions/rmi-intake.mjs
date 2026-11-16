import {createHash} from 'node:crypto';
import {limitedBytes,reply,songUrl,timestamp} from './_shared/free-video-validation.mjs';
import {validatePhoto} from './_shared/free-video-audio.mjs';
export const CHECKOUT='https://buy.stripe.com/6oU28sbZ3epx6jR0IP2wU0E';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function productionStore(){const {getStore}=await import('@netlify/blobs');return getStore({name:'rich-made-it-intake',consistency:'strong'});}
export function createHandler({openStore=productionStore,now=()=>Date.now()}={}){return async req=>{
 if(req.method==='GET'){try{await(await openStore()).get('system/readiness');return reply(200,{available:true});}catch{return reply(503,{available:false});}}
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const url=new URL(req.url);
 if(url.origin!=='https://toonclipz.netlify.app'||req.headers.get('origin')!==url.origin)return reply(403,{error:'Invalid origin'});
 const id=url.searchParams.get('id'),token=req.headers.get('x-upload-token');
 if(!UUID.test(id||'')||!/^([a-f0-9]{64})$/.test(token||''))return reply(400,{error:'Invalid submission'});
 try{
 const store=await openStore(),key='claims/'+id;
 await store.setJSON(key,{tokenHash:sha(token),at:now()},{onlyIfNew:true});
 const claim=await store.get(key,{type:'json'});
 if(claim?.tokenHash!==sha(token))return reply(403,{error:'Invalid submission'});
 if(now()-claim.at>86400000)return reply(410,{error:'Upload expired. Reload and try again.'});
 const existing=await store.get('submissions/'+id,{type:'json'});
 if(url.searchParams.get('receipt')==='1')return existing?reply(200,{received:true,reference:'RMI-'+id,checkout:checkout(id,existing.email)}):reply(404,{received:false});
 if(url.searchParams.has('part')){
 if(existing)return reply(409,{error:'Already submitted'});
 const part=Number(url.searchParams.get('part')),file=url.searchParams.get('file');
 if(!/^(audio|photo[0-4])$/.test(file||'')||!Number.isInteger(part)||part<0||part>16||(file!=='audio'&&part!==0))return reply(400,{error:'Invalid file'});
 const bytes=await limitedBytes(req,3*1024*1024);
 if(!bytes.length)return reply(400,{error:'Empty file'});
 const k=`chunks/${id}/${file}/${part}`,hash=sha(bytes);
 await store.set(k,new Blob([bytes]),{onlyIfNew:true,metadata:{hash}});
 const saved=await store.getWithMetadata(k,{type:'arrayBuffer'});
 if(saved?.metadata?.hash!==hash||sha(Buffer.from(saved.data))!==hash)return reply(409,{error:'File changed. Reload and retry.'});
 return reply(200,{saved:true});
 }
 const body=JSON.parse((await limitedBytes(req,16384)).toString());
 if(existing){if(existing.requestHash!==sha(JSON.stringify(body)))return reply(409,{error:'Already submitted with different details'});return reply(200,{received:true,reference:'RMI-'+id,checkout:checkout(id,existing.email)});}
 const text=(s,n)=>typeof s==='string'&&s.trim().length<=n&&!/[\u0000-\u001f\u007f]/.test(s);
 if(!text(body.name,80)||!body.name.trim()||!text(body.email,254)||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email)||!(typeof (body.notes||'')==='string'&&(body.notes||'').length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.notes||''))||body.rights!==true)return reply(400,{error:'Check your name, email and permission checkbox.'});
 const start=timestamp(body.start||'0:00'),song=body.songUrl?songUrl(body.songUrl):null;
 if(start===null||(body.songUrl&&!song)||(!song&&!body.audio))return reply(400,{error:'Add your song file or a supported song link.'});
 if(!Array.isArray(body.photos)||body.photos.length<1||body.photos.length>5)return reply(400,{error:'Add 1–5 photos.'});
 async function fileBytes(kind,parts,max){
 if(!Number.isInteger(parts)||parts<1||parts>17)throw Error('Invalid file');
 const chunks=[];let size=0;
 for(let i=0;i<parts;i++){const b=await store.get(`chunks/${id}/${kind}/${i}`,{type:'arrayBuffer'});if(!(b instanceof ArrayBuffer))throw Error('Missing upload. Please retry.');if(kind==='audio'&&i<parts-1&&b.byteLength!==3*1024*1024)throw Error('Invalid chunk size');size+=b.byteLength;if(size>max)throw Error('File too large');chunks.push(Buffer.from(b));}
 return Buffer.concat(chunks);
 }
 const files=[];
 for(let i=0;i<body.photos.length;i++){
 const bytes=await fileBytes('photo'+i,1,250000);
 const checked=await validatePhoto({size:bytes.length,name:'reference.jpg',type:'image/jpeg',arrayBuffer:async()=>bytes});
 if(checked.error)return reply(400,{error:'A photo could not be read. Choose JPG or PNG and retry.'});
 files.push({kind:'photo'+i,bytes,...checked.value.descriptor});
 }
 if(body.audio){
 const ext=body.audio.ext,types={mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',flac:'audio/flac'};
 if(!Object.hasOwn(types,ext))return reply(400,{error:'Use MP3, WAV, M4A, AAC, OGG or FLAC.'});
 const b=await fileBytes('audio',body.audio.parts,50*1024*1024),ascii=(a,z)=>b.toString('ascii',a,z);
 const valid=b.length>=16&&({mp3:ascii(0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224),wav:ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE',m4a:ascii(4,8)==='ftyp',aac:b[0]===255&&(b[1]&246)===240,ogg:ascii(0,4)==='OggS',flac:ascii(0,4)==='fLaC'})[ext];
 if(!valid)return reply(400,{error:'This audio file could not be read. Try MP3 or paste a song link.'});
 const chunkHashes=[];for(let i=0;i<b.length;i+=3*1024*1024)chunkHashes.push(sha(b.subarray(i,i+3*1024*1024)));
 files.push({kind:'audio',chunkHashes,bytes:b,name:'song.'+ext,type:types[ext],size:b.length,sha256:sha(b)});
 }
 const descriptors=[];
 for(const f of files){const k=`files/${id}/${f.kind}`;await store.set(k,new Blob([f.bytes],{type:f.type}),{onlyIfNew:true});const saved=await store.get(k,{type:'arrayBuffer'});if(!(saved instanceof ArrayBuffer)||sha(Buffer.from(saved))!==f.sha256)throw Error('Upload not verified. Please retry.');const {bytes,...desc}=f;descriptors.push({...desc,key:k});}
 const record={reference:'RMI-'+id,id,createdAt:new Date(now()).toISOString(),status:'materials_received_payment_unverified',name:body.name.trim(),email:body.email.trim().toLowerCase(),notes:body.notes||'',startSeconds:start,songUrl:song,files:descriptors,rightsConsentedAt:new Date(now()).toISOString(),requestHash:sha(JSON.stringify(body)),offer:{seconds:15,totalCents:2000,startCents:500,balanceCents:1500,currency:'usd'}};
 await store.setJSON('submissions/'+id,record,{onlyIfNew:true});
 const saved=await store.get('submissions/'+id,{type:'json'});
 if(saved?.requestHash!==record.requestHash)throw Error('Submission not verified. Please retry.');
 return reply(201,{received:true,reference:record.reference,checkout:checkout(id,record.email)});
 }catch{return reply(503,{error:'We could not confirm your upload. Retry or use the email / DM options below. Do not pay again.'});}
};}
export function checkout(id,email){const u=new URL(CHECKOUT);u.searchParams.set('client_reference_id','RMI-'+id);u.searchParams.set('prefilled_email',email);return u.href;}
export const config={rateLimit:{windowLimit:80,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
export default createHandler();
