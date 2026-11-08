import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createHandler,saveSubmission} from '../netlify/functions/free-video-submit.mjs';
import {createHandler as inboxHandler} from '../netlify/functions/dashboard-free-video.mjs';
import {validatePhoto,MAX_PHOTO_BYTES} from '../netlify/functions/_shared/free-video-audio.mjs';
import {cookie} from '../netlify/functions/traffic/lib/core.mjs';
const origin='https://toonclipz.netlify.app',key='synthetic-test-secret-never-live',now=Date.now();
const photo=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDyCiiivTNwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=','base64');
const wav=Buffer.alloc(46);wav.write('RIFF');wav.writeUInt32LE(38,4);wav.write('WAVE',8);
class MemoryStore{
 constructor(){this.rows=new Map();this.meta=new Map();}
 async get(k,{type}={}){const x=this.rows.get(k);if(x===undefined)return null;if(type==='json')return structuredClone(x);if(type==='arrayBuffer')return x instanceof Blob?await x.arrayBuffer():null;return x;}
 async set(k,v,o={}){if(o.onlyIfNew&&this.rows.has(k))return {modified:false};this.rows.set(k,v);this.meta.set(k,o.metadata||{});return {modified:true};}
 async setJSON(k,v,o={}){return this.set(k,structuredClone(v),o);}
 async getWithMetadata(k,o){return {data:await this.get(k,o),metadata:this.meta.get(k)};}
 async *list({prefix}){yield {blobs:[...this.rows.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
}
function request(id=randomUUID(),options={}){
 const f=new FormData();for(const [k,v] of Object.entries({requestId:id,artistName:'Synthetic test',email:'test@example.test',songUrl:'',startTime:'0:00',rightsConsent:'true',website:'',...options.fields}))f.append(k,v);
 if(options.photo!==false)f.append('photo',new Blob([options.photo||photo],{type:'image/jpeg'}),'reference.jpg');
 if(options.audio!==false)f.append('audio',new Blob([wav],{type:'audio/wav'}),'song.wav');
 return new Request(origin+'/.netlify/functions/free-video-submit',{method:'POST',headers:{origin:options.origin||origin},body:f});
}
function setup(){const store=new MemoryStore();return {store,handler:createHandler({openStore:async()=>store}),inbox:inboxHandler({env:{TOONCLIPZ_DASHBOARD_PASSWORD:key},openStore:async()=>store,now:()=>now})};}
function ownerRequest(query='',withCookie=true){return new Request(origin+'/.netlify/functions/dashboard-free-video'+query,{headers:withCookie?{cookie:cookie(key,now).split(';')[0]}:{}});}
test('photo and audio save with verified bytes, private inbox can read both',async()=>{
 const {store,handler,inbox}=setup(),id=randomUUID();const response=await handler(request(id));assert.equal(response.status,201);assert.equal((await response.json()).reference,id);
 const row=await store.get('submissions/'+id,{type:'json'});assert.equal(row.photo.sha256,createHash('sha256').update(photo).digest('hex'));assert.equal(row.audio.size,wav.length);
 const list=await inbox(ownerRequest());assert.equal(list.status,200);const data=await list.json();assert.equal(data.entries.length,1);assert.equal(data.entries[0].hasPhoto,true);assert.equal(data.entries[0].hasAudio,true);assert.ok(!JSON.stringify(data).includes('fingerprint'));
 for(const [kind,bytes] of [['photo',photo],['audio',wav]]){const r=await inbox(ownerRequest('?reference='+id+'&file='+kind));assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);assert.match(r.headers.get('cache-control'),/no-store/);}
});
test('photo plus song link succeeds without audio; missing photo or song fails',async()=>{
 const {handler}=setup();assert.equal((await handler(request(randomUUID(),{audio:false,fields:{songUrl:'https://youtu.be/example'}}))).status,201);
 for(const opts of [{photo:false},{audio:false}]){const h=setup();assert.equal((await h.handler(request(randomUUID(),opts))).status,400);assert.equal([...h.store.rows.keys()].filter(k=>k.startsWith('submissions')).length,0);}
});
test('missing rights, foreign origin, spoofed image and overlimit image fail before storage',async()=>{
 for(const opts of [{fields:{rightsConsent:'false'}},{origin:'https://evil.test'},{photo:Buffer.from('<html>not an image</html>')},{photo:Buffer.alloc(MAX_PHOTO_BYTES+1)}]){const {handler,store}=setup();assert.ok([400,403].includes((await handler(request(randomUUID(),opts))).status));assert.equal(store.rows.size,0);}
});
test('same request retries without duplicate; changed data conflicts; hourly duplicate rejects',async()=>{
 const {handler,store}=setup(),id=randomUUID();assert.equal((await handler(request(id))).status,201);assert.equal((await handler(request(id))).status,201);assert.equal((await handler(request(id,{fields:{artistName:'Changed'}}))).status,409);assert.equal((await handler(request())).status,429);assert.equal([...store.rows.keys()].filter(k=>k.startsWith('submissions')).length,1);
});
test('public, invalid, expired and unconfigured owner requests never open storage',async()=>{
 let opened=0;const h=inboxHandler({env:{TOONCLIPZ_DASHBOARD_PASSWORD:key},openStore:async()=>{opened++;throw new Error('must not open');},now:()=>now});
 assert.equal((await h(ownerRequest('',false))).status,401);
 assert.equal((await h(new Request(origin,{headers:{cookie:'__Host-toonclipz-dashboard=0000000000000.fake'}}))).status,401);
 assert.equal(opened,0);
 const noConfig=inboxHandler({env:{},openStore:async()=>{opened++;}});assert.equal((await noConfig(ownerRequest())).status,503);assert.equal(opened,0);
});
test('inbox rejects traversal, missing and corrupted stored media',async()=>{
 const {handler,store,inbox}=setup(),id=randomUUID();await handler(request(id));
 assert.equal((await inbox(ownerRequest('?reference=../../system/hash-salt&file=photo'))).status,400);
 assert.equal((await inbox(ownerRequest('?reference='+randomUUID()+'&file=photo'))).status,404);
 store.rows.set('photo/'+id,new Blob([Buffer.from('tampered')]));assert.equal((await inbox(ownerRequest('?reference='+id+'&file=photo'))).status,503);
});
test('inbox returns no data when storage fails; submission cannot falsely confirm failed file write',async()=>{
 const store=new MemoryStore();const set=store.set.bind(store);store.set=async(k,v,o)=>{if(k.startsWith('photo/'))throw new Error('write failed');return set(k,v,o);};
 const handler=createHandler({openStore:async()=>store});assert.equal((await handler(request())).status,503);assert.equal([...store.rows.keys()].filter(k=>k.startsWith('submissions')).length,0);
 const inbox=inboxHandler({env:{TOONCLIPZ_DASHBOARD_PASSWORD:key},openStore:async()=>{throw new Error('private error');},now:()=>now});const response=await inbox(ownerRequest());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private error'));
});

test('inbox pagination makes every entry reachable even with unordered provider listing',async()=>{
 const {store,inbox}=setup(),ids=Array.from({length:201},()=>randomUUID()).sort();
 for(const id of [...ids].reverse())await store.setJSON('submissions/'+id,{reference:id,createdAt:new Date().toISOString(),artistName:'Synthetic',email:'synthetic@example.test'});
 let cursor='',seen=new Set(),pages=0;
 do{const r=await inbox(ownerRequest(cursor?'?after='+cursor:''));assert.equal(r.status,200);const d=await r.json();for(const row of d.entries){assert.ok(!seen.has(row.reference));seen.add(row.reference);}cursor=d.nextCursor;pages++;}while(cursor);
 assert.equal(pages,3);assert.equal(seen.size,201);
});
test('photo validator rejects marker-only fake JPEG',async()=>{
 assert.equal((await validatePhoto({name:'test.jpg',type:'image/jpeg',size:66,arrayBuffer:async()=>Buffer.from([255,216,255,224,...Array(60).fill(0),255,217])})).error,'photoType');
});
