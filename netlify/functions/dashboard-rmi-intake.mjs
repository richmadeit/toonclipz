import {authorized,json,secret} from './traffic/lib/core.mjs';
import {productionStore} from './rmi-intake.mjs';
import {createHash} from 'node:crypto';
export function createHandler({env=process.env,openStore=productionStore,now=()=>Date.now()}={}){return async req=>{
 if(req.method!=='GET')return json(405,{error:'Method not allowed'});
 const key=secret(env);if(!key)return json(503,{error:'Dashboard unavailable'});if(!authorized(req,key,now()))return json(401,{error:'Sign in with your existing dashboard password.'});
 try{const store=await openStore(),u=new URL(req.url),id=u.searchParams.get('id'),file=u.searchParams.get('file');
 if(id){if(!/^[a-f0-9-]{36}$/.test(id))return json(400,{error:'Invalid reference'});const row=await store.get('submissions/'+id,{type:'json'});if(!row)return json(404,{error:'Not found'});if(!file)return json(200,row);const f=row.files.find(x=>x.kind===file);if(!f)return json(404,{error:'Not found'});let expected=f.sha256,storageKey=f.key;if(file==='audio'){const part=Number(u.searchParams.get('part'));if(!u.searchParams.has('part')||!Number.isInteger(part)||part<0||part>=f.chunkHashes.length)return json(400,{error:'Use the inbox download button.'});expected=f.chunkHashes[part];storageKey=`chunks/${id}/audio/${part}`;}const b=await store.get(storageKey,{type:'arrayBuffer'});if(!(b instanceof ArrayBuffer)||createHash('sha256').update(Buffer.from(b)).digest('hex')!==expected)throw Error();return new Response(b,{headers:{'Content-Type':f.type,'Content-Disposition':`attachment; filename="${f.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}
 const cursor=u.searchParams.get('after')||'';if(cursor&&!/^[a-f0-9-]{36}$/.test(cursor))return json(400,{error:'Invalid cursor'});
 let keys=[];for await(const page of store.list({prefix:'submissions/',paginate:true})){for(const b of page.blobs){if(b.key.slice(12)>cursor)keys.push(b.key);}keys.sort();keys=keys.slice(0,101);}
 const more=keys.length>100;keys=keys.slice(0,100);const entries=await Promise.all(keys.map(k=>store.get(k,{type:'json'})));return json(200,{entries:entries.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),nextCursor:more?keys.at(-1).slice(12):null});
 }catch{return json(503,{error:'Intake unavailable. This is not an empty queue.'});}
};}
export default createHandler();
