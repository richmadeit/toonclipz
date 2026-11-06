import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,readDepositOrders} from '../netlify/functions/dashboard-orders.mjs';
import {cookie} from '../netlify/functions/traffic/lib/core.mjs';
import {DEPOSIT_LINK} from '../netlify/functions/_shared/deposit-orders.mjs';
const now=Date.now(),key='synthetic-test-password-1234',ref='TC-D60-12345678-1234-4123-8123-123456789abc';
const session=()=>({id:'cs_live_synthetic123456789',client_reference_id:ref,livemode:true,mode:'payment',status:'complete',payment_status:'paid',payment_link:{url:DEPOSIT_LINK},currency:'usd',amount_subtotal:500,amount_total:500,created:Math.floor(now/1000),payment_intent:{id:'pi_synthetic',livemode:true,status:'succeeded',currency:'usd',amount:500,amount_received:500,latest_charge:{id:'ch_synthetic',payment_intent:'pi_synthetic',livemode:true,status:'succeeded',paid:true,captured:true,currency:'usd',amount:500,refunded:false,amount_refunded:0,disputed:false}}});
const order=()=>({status:'materials_submitted',ref,fingerprint:'fingerprint',artistName:'Synthetic Artist',email:'synthetic@example.test',tier:60,createdAt:new Date(now).toISOString(),photoCount:1,hasSongFile:true,hasSongLink:false,submission:{start_time:'0:10',end_time:'0:25',photo_paths:['private-path'],song_path:'private-song'}});
const store=(record=order(),claim={fingerprint:'fingerprint'})=>({get:async k=>k==='orders/'+ref?record:k==='claims/'+ref?claim:null});
const env={TOONCLIPZ_DASHBOARD_PASSWORD:key,STRIPE_SECRET_KEY:'synthetic-key-only'};
const run=(rows,options={})=>readDepositOrders({store:store(),env,since:now-86400000,now,fetchImpl:async()=>Response.json({data:rows,has_more:false}),...options});
test('endpoint fails closed before touching private storage or Stripe',async()=>{
 let touched=false;const openStore=async()=>{touched=true;throw Error();};
 const handler=createHandler({env,openStore,now:()=>now});
 const response=await handler(new Request('https://site.test/.netlify/functions/dashboard-orders'));
 assert.equal(response.status,401);assert.equal(touched,false);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await createHandler({env:{},openStore})(new Request('https://site.test'))).status,503);
 assert.equal((await handler(new Request('https://site.test',{method:'POST'}))).status,405);
 const forged=await handler(new Request('https://site.test',{headers:{cookie:'__Host-toonclipz-dashboard=invalid'}}));assert.equal(forged.status,401);
});
test('fresh live paid session joins immutable order claim without a return-page payment marker',async()=>{
 const value=await run([session()]);assert.equal(value.available,true);assert.equal(value.orders.length,1);assert.equal(value.orders[0].reference,ref);assert.equal(value.orders[0].state,'paid_materials_submitted');
 const body=JSON.stringify(value);for(const privateValue of ['private-path','private-song','synthetic-key-only','cs_live_synthetic','pi_synthetic','ch_synthetic','fingerprint'])assert.ok(!body.includes(privateValue));
});
test('missing private order and mismatched claim are surfaced for review, never ready',async()=>{
 for(const db of [store(null),store(order(),{fingerprint:'other'})]){const value=await run([session()],{store:db});assert.equal(value.orders.length,0);assert.equal(value.unmatched,1);}
});
test('refunds, disputes, missing charge, partial amount and unlinked payments fail current verification',async()=>{
 const variants=[];
 for(const change of [{amount_refunded:1},{refunded:true},{disputed:true},{captured:false},{status:'pending'}]){const s=session();Object.assign(s.payment_intent.latest_charge,change);variants.push(s);}
 let s=session();s.payment_intent.latest_charge=null;variants.push(s);s=session();s.amount_total=501;variants.push(s);s=session();s.client_reference_id=null;variants.push(s);
 const result=await run(variants);assert.equal(result.orders.length,0);assert.equal(result.needsReview,variants.length);
});
test('sandbox, unpaid, wrong store and incomplete sessions are not shown',async()=>{
 const base=session();const rows=[{...base,livemode:false},{...base,status:'open'},{...base,payment_status:'unpaid'},{...base,payment_link:{url:'https://buy.stripe.com/unrelated'}}];
 const result=await run(rows);assert.equal(result.orders.length,0);assert.equal(result.needsReview,0);
});
test('duplicates do not double-create orders and pagination is bounded and explicit',async()=>{
 let calls=0;const fetchImpl=async url=>{calls++;if(calls>1)assert.equal(url.searchParams.get('starting_after'),session().id);return Response.json({data:[session()],has_more:true});};
 const result=await run([],{fetchImpl});assert.equal(calls,5);assert.equal(result.orders.length,1);assert.equal(result.duplicatePayments,4);assert.equal(result.truncated,true);
});
test('failed provider reads return unavailable, never a false empty queue',async()=>{
 const handler=createHandler({env,openStore:async()=>store(),fetchImpl:async()=>new Response('',{status:503}),now:()=>now});
 const result=await handler(new Request('https://site.test/.netlify/functions/dashboard-orders?range=7d',{headers:{cookie:cookie(key,now).split(';')[0]}}));
 assert.equal(result.status,503);assert.match((await result.json()).error,/Do not treat this as an empty queue/);
});
test('authenticated success is no-store and selected seven-day period is passed to Stripe',async()=>{
 const handler=createHandler({env,openStore:async()=>store(),fetchImpl:async url=>{assert.equal(url.searchParams.get('created[gte]'),String(Math.floor((now-7*86400000)/1000)));return Response.json({data:[session()],has_more:false});},now:()=>now});
 const result=await handler(new Request('https://site.test/.netlify/functions/dashboard-orders?range=7d',{headers:{cookie:cookie(key,now).split(';')[0]}}));
 assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).orders.length,1);
});
