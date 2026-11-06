import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/deposit-order.mjs';
import {validateOrder,prepareOrder,markDepositPaid,SITE_ORIGIN,DEPOSIT_LINK} from '../netlify/functions/_shared/deposit-orders.mjs';
const uuid='12345678-1234-4234-8234-123456789abc';
const ref='TC-D30-'+uuid;
const path=kind=>ref+'/'+uuid+'/'+kind+'-'+uuid+(kind==='photo'?'.jpg':'.mp3');
const fetchWithFiles=insert=>async(url,options)=>options.method==='HEAD'?{status:200,headers:new Headers({'content-length':'1024','content-type':url.endsWith('.jpg')?'image/jpeg':'audio/mpeg'})}:insert(url,options);
const input=()=>({ref,artist_name:'Artist',email:'artist@example.com',contact:'Creative idea: sunset',photo_paths:[path('photo')],song_path:path('song'),song_url:'',start_time:'0:00',end_time:'0:15',style:'realistic',visual_style:'gta-cinematic'});
function storeMock(){
 const entries=new Map();
 return {entries,get:async key=>structuredClone(entries.get(key)??null),setJSON:async(key,value,{onlyIfNew}={})=>{
  if(onlyIfNew&&entries.has(key))return {modified:false};entries.set(key,structuredClone(value));return {modified:true};
 }};
}
function request(body=input(),options={}){
 return new Request(options.url||SITE_ORIGIN+'/.netlify/functions/deposit-order',{method:'POST',headers:{origin:SITE_ORIGIN,'content-type':'application/json',...options.headers},body:typeof body==='string'?body:JSON.stringify(body)});
}
const session=()=>({id:'cs_live_abcdefghijklmnop',client_reference_id:ref,livemode:true,mode:'payment',status:'complete',payment_status:'paid',payment_link:{url:DEPOSIT_LINK},currency:'usd',amount_subtotal:500,amount_total:500,payment_intent:{id:'pi_example',livemode:true,status:'succeeded',currency:'usd',amount:500,amount_received:500,latest_charge:{id:'ch_example',payment_intent:'pi_example',livemode:true,status:'succeeded',paid:true,captured:true,currency:'usd',amount:500,refunded:false,amount_refunded:0,disputed:false}}});

test('canonical-origin endpoint saves matching row and private receipt before returning checkout',async()=>{
 const store=storeMock(),calls=[];
 const handler=createHandler({openStore:async()=>store,fetchImpl:fetchWithFiles(async(url,options)=>{calls.push({url,...options});assert.ok(store.entries.has('claims/'+ref));assert.ok(!store.entries.has('orders/'+ref));return {status:201};})});
 const response=await handler(request());assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{ok:true,ref,checkoutUrl:DEPOSIT_LINK+'?client_reference_id='+ref});
 assert.equal(calls.length,1);assert.equal(calls[0].method,'POST');assert.equal(calls[0].headers.Prefer,'return=minimal');
 const row=JSON.parse(calls[0].body);assert.equal(row.id,uuid);assert.equal(row.ref,ref);assert.match(row.contact,/UNVERIFIED/);
 assert.deepEqual(Object.keys(row).sort(),['id','ref','artist_name','contact','photo_paths','song_path','song_url','start_time','end_time','style'].sort());
 assert.equal(store.entries.get('orders/'+ref).status,'materials_submitted');assert.equal(store.entries.has('payments/'+ref),false);
 assert.equal((await handler(request())).status,201);assert.equal(calls.length,1,'identical retry skips duplicate insert');
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('strict validation rejects unknown fields, unsafe paths, insufficient materials and invalid timestamps',()=>{
 for(const patch of [
  {ref:'TC-D-'+uuid},{ref:'TC-D15-'+uuid},{ref:'TC-D30-not-a-uuid'},{id:uuid},{paid:true},
  {email:'bad'},{email:'a@example.com\nInjected'}, {contact:'x'.repeat(4001)}, {photo_paths:'photo'},
  {photo_paths:[path('photo'),path('photo')]},{photo_paths:[path('photo').replace(ref,'TC-D60-'+uuid)]},
  {photo_paths:[ref+'/../photo.jpg']},{song_path:path('song').replace('.mp3','.exe')},
  {song_path:'',song_url:''},{song_url:'javascript:alert(1)'},{song_url:'https://unknown.example/song'},{song_url:'https://soundcloud.com/'},{song_url:'https://user:password@example.com/song'},
  {start_time:''},{start_time:'0:99'},{end_time:'0:16'},{end_time:'0:00'},{style:'other'},
  {visual_style:'unknown'},{photo_paths:[]}
 ])assert.ok(validateOrder({...input(),...patch}).error,JSON.stringify(patch));
 for(const tier of [30,60,180]){
  const v={...input(),ref:'TC-D'+tier+'-'+uuid,photo_paths:[],song_path:'',song_url:'https://soundcloud.com/artist/song',visual_style:'characters'};
  assert.equal(validateOrder(v).tier,tier);
 }
 assert.equal(validateOrder({...input(),photo_paths:[],visual_style:'characters'}).error,undefined);
});

test('cross-origin, preview-domain, missing Origin, oversized and malformed requests cause no writes',async()=>{
 let opened=0;
 const handler=createHandler({openStore:async()=>{opened++;throw new Error('must not open');}});
 for(const [req,status] of [
  [request(input(),{url:'https://preview.netlify.app/.netlify/functions/deposit-order'}),403],
  [request(input(),{headers:{origin:'https://attacker.example'}}),403],
  [request(input(),{headers:{origin:''}}),403],
  [request(input(),{headers:{'sec-fetch-site':'cross-site'}}),403],
  [request(input(),{headers:{'content-type':'text/plain'}}),415],
  [request('{'),400],[request('x'.repeat(16385)),413],
  [new Request(SITE_ORIGIN+'/.netlify/functions/deposit-order',{method:'DELETE'}),405]
 ])assert.equal((await handler(req)).status,status);
 assert.equal(opened,0);
});

test('immutable private claims reject changed retries before any insert',async()=>{
 const store=storeMock();let inserts=0;
 const insert=async()=>{inserts++;return 'inserted';};
 await prepareOrder(store,validateOrder(input()),insert);
 const changed=validateOrder({...input(),contact:'Different instructions'});
 assert.equal((await prepareOrder(store,changed,insert)).status,'conflict');assert.equal(inserts,1);
});

test('uncertain insert or foreign duplicate never becomes a prepared order',async()=>{
 const store=storeMock();
 await assert.rejects(prepareOrder(store,validateOrder(input()),async()=>{throw new Error('network lost');}));
 assert.equal(store.entries.has('orders/'+ref),false);
 assert.equal((await prepareOrder(store,validateOrder(input()),async()=>'conflict')).status,'insert_unconfirmed');
 assert.equal(store.entries.has('orders/'+ref),false);
 assert.equal((await markDepositPaid(session(),{openStore:async()=>store})).status,'unmatched');
});

test('failed durable receipt read-back never returns a checkout URL',async()=>{
 const store=storeMock(),set=store.setJSON;
 store.setJSON=async(key,value,options)=>key.startsWith('orders/')?{modified:false}:set(key,value,options);
 const handler=createHandler({openStore:async()=>store,fetchImpl:fetchWithFiles(async()=>({status:201}))});
 const response=await handler(request());assert.equal(response.status,503);
 assert.equal((await response.json()).checkoutUrl,undefined);
});

test('concurrent different input claims do not overwrite a row or private receipt',async()=>{
 const store=storeMock();let inserts=0;
 const outcomes=await Promise.all([input(),{...input(),artist_name:'Different artist'}].map(body=>prepareOrder(store,validateOrder(body),async()=>{inserts++;return 'inserted';})));
 assert.deepEqual(outcomes.map(x=>x.status).sort(),['conflict','prepared']);assert.equal(inserts,1);
 assert.equal(store.entries.get('orders/'+ref).artistName,'Artist');
});

test('matching genuine live deposit creates immutable private paid marker with queue summary',async()=>{
 const store=storeMock();await prepareOrder(store,validateOrder(input()),async()=>'inserted');
 const options={openStore:async()=>store,now:()=>new Date('2026-11-06T12:00:00Z')};
 assert.equal((await markDepositPaid(session(),options)).status,'matched_paid');
 const marker=store.entries.get('payments/'+ref);
 assert.equal(marker.email,'artist@example.com');assert.equal(marker.ref,ref);assert.equal(marker.tier,30);
 assert.equal(marker.amount,500);assert.equal(marker.verifiedPaidAt,'2026-11-06T12:00:00.000Z');
 assert.equal(marker.orderFingerprint,store.entries.get('orders/'+ref).fingerprint);
 assert.equal(marker.status,'deposit_paid_materials_submitted');
 assert.equal((await markDepositPaid(session(),{...options,now:()=>new Date('2026-11-07T12:00:00Z')})).status,'matched_paid');
 assert.equal(store.entries.get('payments/'+ref).verifiedPaidAt,marker.verifiedPaidAt);
 const second=session();second.id='cs_live_abcdefghijklmnop2';
 assert.equal((await markDepositPaid(second,options)).status,'payment_conflict');
 await prepareOrder(store,validateOrder(input()),async()=>{throw new Error('must not reinsert');});
 assert.deepEqual(store.entries.get('payments/'+ref),marker,'preparation retry never erases payment');
});

test('test, unpaid, unsupported, refunded, disputed or mismatched charge sessions cannot mark paid',async()=>{
 const patches=[
  s=>s.id='cs_test_abcdefghijklmnop',s=>s.livemode=false,s=>s.mode='subscription',s=>s.status='open',s=>s.payment_status='unpaid',
  s=>s.payment_link.url='https://buy.stripe.com/other',s=>s.currency='eur',s=>s.amount_total=501,s=>s.amount_subtotal=499,
  s=>s.payment_intent.status='processing',s=>s.payment_intent.livemode=false,s=>s.payment_intent.amount_received=499,
  s=>s.payment_intent.latest_charge.refunded=true,s=>s.payment_intent.latest_charge.amount_refunded=1,
  s=>s.payment_intent.latest_charge.disputed=true,s=>s.payment_intent.latest_charge.captured=false,
  s=>s.payment_intent.latest_charge.status='failed',s=>s.payment_intent.latest_charge.paid=false,
  s=>s.payment_intent.latest_charge.livemode=false,s=>s.payment_intent.latest_charge.payment_intent='pi_other',
  s=>s.payment_intent.latest_charge.amount=499,s=>s.payment_intent.latest_charge.currency='eur',
  s=>s.client_reference_id='TC-D-old',s=>s.payment_intent='pi_example',s=>s.payment_intent.latest_charge='ch_example'
 ];
 for(const patch of patches){
  const s=session();patch(s);let opens=0;
  assert.equal((await markDepositPaid(s,{openStore:async()=>{opens++;throw new Error('must not open');}})).status,'not_eligible');
  assert.equal(opens,0);
 }
});

test('missing or inconsistent private material receipt cannot become paid and storage errors surface',async()=>{
 const store=storeMock(),options={openStore:async()=>store};
 assert.equal((await markDepositPaid(session(),options)).status,'unmatched');
 await prepareOrder(store,validateOrder(input()),async()=>'inserted');
 store.entries.set('claims/'+ref,{fingerprint:'different'});
 assert.equal((await markDepositPaid(session(),options)).status,'unmatched');
 await assert.rejects(markDepositPaid(session(),{openStore:async()=>{throw new Error('offline');}}),/offline/);
});


test('HEAD verifies nonempty stored bytes before insertion and never downloads files or song links',async()=>{
 const store=storeMock(),calls=[];
 const handler=createHandler({openStore:async()=>store,fetchImpl:async(url,options)=>{
  calls.push({url,...options});
  if(options.method==='HEAD'){
   assert.ok(!store.entries.has('orders/'+ref));assert.equal(options.redirect,'error');
   assert.match(url,new RegExp('/storage/v1/object/authenticated/submissions/'+ref+'/'));
   return {status:200,headers:new Headers({'content-length':'1024','content-type':url.endsWith('.jpg')?'image/jpeg':'audio/mpeg'})};
  }
  assert.equal(calls.filter(c=>c.method==='HEAD').length,2);return {status:201};
 }});
 const response=await handler(request({...input(),song_url:'https://soundcloud.com/artist/song'}));
 assert.equal(response.status,201);assert.deepEqual(calls.map(c=>c.method),['HEAD','HEAD','POST']);
 assert.equal(store.entries.get('orders/'+ref).fileVerification.files.length,2);
 assert.ok(calls.every(c=>new URL(c.url).hostname==='molqlfdjlmnlkscecngz.supabase.co'));
});

test('missing, empty, oversized, unreadable and wrong-MIME uploads cannot reach insert or checkout',async()=>{
 const cases=[
  {status:404,size:'1024',type:'image/jpeg'},
  {status:403,size:'1024',type:'image/jpeg'},
  {status:200,size:'0',type:'image/jpeg'},
  {status:200,size:'',type:'image/jpeg'},
  {status:200,size:'1.5',type:'image/jpeg'},
  {status:200,size:String(10*1048576+1),type:'image/jpeg'},
  {status:200,size:'100',type:'text/html'},
  {status:200,size:'100',type:'image/png'},
  {throw:true},
  {song:true,status:200,size:'0',type:'audio/mpeg'},
  {song:true,status:200,size:String(50*1048576+1),type:'audio/mpeg'},
  {song:true,status:200,size:'100',type:'application/octet-stream'}
 ];
 for(const scenario of cases){
  let writes=0;
  const handler=createHandler({openStore:async()=>{writes++;return storeMock();},fetchImpl:async(url,options)=>{
   assert.equal(options.method,'HEAD','invalid files must never reach database insert');
   const target=scenario.song?url.endsWith('.mp3'):url.endsWith('.jpg');
   if(target&&scenario.throw)throw new Error('Storage unavailable');
   return target?{status:scenario.status,headers:new Headers({'content-length':scenario.size,'content-type':scenario.type})}:{status:200,headers:new Headers({'content-length':'1024','content-type':url.endsWith('.jpg')?'image/jpeg':'audio/mpeg'})};
  }});
  const response=await handler(request());assert.equal(response.status,422,JSON.stringify(scenario));
  assert.deepEqual(await response.json(),{ok:false,error:'files_unverified'});assert.equal(writes,0);
 }
});

test('animal song-link orders have no file HEAD requests and only trusted links are accepted',async()=>{
 const calls=[],store=storeMock();
 const handler=createHandler({openStore:async()=>store,fetchImpl:async(url,options)=>{calls.push({url,...options});return {status:201};}});
 const body={...input(),photo_paths:[],visual_style:'characters',song_path:'',song_url:'https://youtu.be/example'};
 assert.equal((await handler(request(body))).status,201);assert.deepEqual(calls.map(c=>c.method),['POST']);
 const invalid=await handler(request({...body,song_url:'https://evil.example/song'}));assert.equal(invalid.status,400);assert.equal(calls.length,1);
});


test('GET availability is a read-only private-store probe with no PII or database writes',async()=>{
 const reads=[];
 const handler=createHandler({openStore:async()=>({get:async(key,options)=>{reads.push({key,options});return null;}}),fetchImpl:async()=>{throw new Error('must not access Supabase');}});
 for(const headers of [{},{origin:SITE_ORIGIN}]){
  const response=await handler(new Request(SITE_ORIGIN+'/.netlify/functions/deposit-order',{headers}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{available:true});
 }
 assert.deepEqual(reads,[{key:'system/readiness',options:{type:'json'}},{key:'system/readiness',options:{type:'json'}}]);
 for(const req of [new Request('https://preview.netlify.app/.netlify/functions/deposit-order'),new Request(SITE_ORIGIN+'/.netlify/functions/deposit-order',{headers:{origin:'https://evil.example'}})]){
  const response=await handler(req);assert.equal(response.status,403);assert.deepEqual(await response.json(),{available:false});
 }
 assert.equal(reads.length,2);
 const unavailable=createHandler({openStore:async()=>{throw new Error('not configured');}});
 const response=await unavailable(new Request(SITE_ORIGIN+'/.netlify/functions/deposit-order'));
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{available:false});
});
