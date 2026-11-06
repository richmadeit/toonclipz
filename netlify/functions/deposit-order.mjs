import {SITE_ORIGIN,productionStore,validateOrder,prepareOrder,checkoutUrl} from './_shared/deposit-orders.mjs';

// Existing public anon key: table INSERT and existing private-bucket SELECT policy. No elevated credential or new access.
const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHFsZmRqbG1ubGtzY2Vjbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODEzNjMsImV4cCI6MjA5MzE1NzM2M30._CR9A4H7-E7CYzIWdEO4PgRcCgBcORP2wAZqXrXE4Ec';
const ENDPOINT='https://molqlfdjlmnlkscecngz.supabase.co/rest/v1/submissions';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function limitedJson(request){
  const limit=16384;
  if(Number(request.headers.get('content-length'))>limit)throw new Error('too_large');
  const reader=request.body?.getReader();if(!reader)throw new Error('invalid');
  let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('too_large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
// HEAD reads object headers through the existing SELECT policy. No downloads,
// signed URLs, public URLs, credential changes or external song-link fetches.
export async function verifyStoredFiles(value,fetchImpl=globalThis.fetch,now=new Date()){
  const files=[...value.photo_paths.map(path=>({path,kind:'photo'})),...(value.song_path?[{path:value.song_path,kind:'song'}]:[])];
  const verified=await Promise.all(files.map(async file=>{
    const response=await fetchImpl('https://molqlfdjlmnlkscecngz.supabase.co/storage/v1/object/authenticated/submissions/'+file.path,{method:'HEAD',headers:{apikey:ANON_KEY,Authorization:'Bearer '+ANON_KEY},redirect:'error',signal:AbortSignal.timeout(15000)});
    const rawSize=response.headers?.get('content-length')||'';
    const size=/^\d+$/.test(rawSize)?Number(rawSize):NaN;
    const contentType=(response.headers?.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const extension=file.path.split('.').pop();
    const imageTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
    const validType=file.kind==='photo'?imageTypes[extension]===contentType:/^(audio|video)\/[a-z0-9.+-]+$/.test(contentType)||(contentType==='application/ogg'&&['ogg','oga'].includes(extension));
    if(response.status!==200||!Number.isSafeInteger(size)||size<=0||size>(file.kind==='photo'?10:50)*1048576||!validType)throw new Error('files_unverified');
    return {...file,size,contentType};
  }));
  return {verifiedAt:now.toISOString(),files:verified};
}
export function createHandler({openStore=productionStore,fetchImpl=globalThis.fetch,now=()=>new Date()}={}){
  return async request=>{
    if(request.method==='GET'){
      const origin=request.headers.get('origin');
      if(new URL(request.url).origin!==SITE_ORIGIN||(origin!==null&&origin!==SITE_ORIGIN)||['cross-site','none'].includes(request.headers.get('sec-fetch-site')))return reply(403,{available:false});
      try{await (await openStore()).get('system/readiness',{type:'json'});return reply(200,{available:true});}
      catch{return reply(503,{available:false});}
    }
    if(request.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
    if(new URL(request.url).origin!==SITE_ORIGIN||request.headers.get('origin')!==SITE_ORIGIN||['cross-site','none'].includes(request.headers.get('sec-fetch-site')))return reply(403,{ok:false,error:'invalid_origin'});
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{ok:false,error:'invalid_content_type'});
    let body;try{body=await limitedJson(request);}catch(e){return reply(e.message==='too_large'?413:400,{ok:false,error:'invalid_request'});}
    const validated=validateOrder(body);
    if(validated.error)return reply(400,{ok:false,error:'invalid_request',field:validated.error});
    try{
      try{validated.fileVerification=await verifyStoredFiles(validated.value,fetchImpl,now());}
      catch{return reply(422,{ok:false,error:'files_unverified'});}
      const insert=async row=>{
        const response=await fetchImpl(ENDPOINT,{method:'POST',headers:{apikey:ANON_KEY,Authorization:'Bearer '+ANON_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(15000)});
        return response.status===201?'inserted':response.status===409?'conflict':'unavailable';
      };
      const result=await prepareOrder(await openStore(),validated,insert,now());
      if(result.status==='prepared')return reply(201,{ok:true,ref:validated.value.ref,checkoutUrl:checkoutUrl(validated.value.ref)});
      if(['conflict','insert_unconfirmed'].includes(result.status))return reply(409,{ok:false,error:result.status});
    }catch{/* Do not expose submitted information, storage details or provider errors. */}
    return reply(503,{ok:false,error:'unavailable'});
  };
}
export const config={rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};
export default createHandler();
