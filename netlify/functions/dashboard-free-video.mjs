import {authorized,json,secret} from './traffic/lib/core.mjs';
import {productionStore} from './free-video-submit.mjs';
import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const audioTypes=new Set(['audio/mpeg','audio/wav','audio/mp4','audio/aac','audio/ogg','audio/flac']);
export function createHandler({env=process.env,openStore=productionStore,now=()=>Date.now()}={}){
  return async request=>{
    if(request.method!=='GET')return json(405,{error:'Method not allowed'});
    const key=secret(env);
    if(!key)return json(503,{error:'Dashboard setup is not complete.'});
    if(!authorized(request,key,now()))return json(401,{error:'Sign in with your existing dashboard password.'});
    try{
      const store=await openStore(),url=new URL(request.url),reference=url.searchParams.get('reference'),kind=url.searchParams.get('file');
      if(reference || kind){
        if(!UUID.test(reference||'') || !['photo','audio'].includes(kind))return json(400,{error:'Invalid file request'});
        const row=await store.get('submissions/'+reference,{type:'json'}),file=row?.[kind];
        if(!file || file.key!==kind+'/'+reference)return json(404,{error:'File not found'});
        if(kind==='photo' ? file.type!=='image/jpeg' : !audioTypes.has(file.type))return json(404,{error:'File not available'});
        const bytes=await store.get(file.key,{type:'arrayBuffer'});
        if(!(bytes instanceof ArrayBuffer) || bytes.byteLength!==file.size || createHash('sha256').update(Buffer.from(bytes)).digest('hex')!==file.sha256)throw new Error('File verification failed');
        const name=kind==='photo'?'reference.jpg':/^song\.(mp3|wav|m4a|aac|ogg|flac)$/.test(file.name)?file.name:'song';
        return new Response(bytes,{headers:{'Content-Type':file.type,'Content-Length':String(bytes.byteLength),'Content-Disposition':`${url.searchParams.get('download')==='1'?'attachment':'inline'}; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; sandbox",'X-Frame-Options':'DENY'}});
      }
      const after=url.searchParams.get('after')||'';
      if(after && !UUID.test(after))return json(400,{error:'Invalid page cursor'});
      // Keep the smallest 101 keys after the cursor, regardless of provider listing order.
      // Only 100 records are loaded. All entries remain reachable through the next cursor.
      const keys=[];
      for await(const page of store.list({prefix:'submissions/',paginate:true})){
        for(const blob of page.blobs){
          const id=blob.key.slice('submissions/'.length);
          if(!UUID.test(id) || id<=after)continue;
          keys.push(blob.key);
          if(keys.length>101){keys.sort();keys.length=101;}
        }
      }
      keys.sort();const hasMore=keys.length>100;keys.length=Math.min(100,keys.length);
      const nextCursor=hasMore?keys.at(-1).slice('submissions/'.length):null;
      const rows=[];
      for(let i=0;i<keys.length;i+=25){
        const batch=await Promise.all(keys.slice(i,i+25).map(k=>store.get(k,{type:'json'})));
        for(const row of batch){
          if(!row || !UUID.test(row.reference||''))continue;
          rows.push({reference:row.reference,artistName:String(row.artistName||'').slice(0,80),email:String(row.email||'').slice(0,254),createdAt:row.createdAt,startSeconds:Number(row.startSeconds)||0,clipSeconds:15,songUrl:row.songUrl,hasPhoto:Boolean(row.photo),hasAudio:Boolean(row.audio),rightsVersion:row.rightsVersion,status:row.status});
        }
      }
      rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(200,{entries:rows,nextCursor,checkedAt:now()});
    }catch{return json(503,{error:'Free entries could not be loaded. This is not an empty queue. Please refresh shortly.'});}
  };
}
export const config={rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
export default createHandler();
