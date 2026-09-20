import test from 'node:test';
import assert from 'node:assert/strict';
import {authorized,cleanEvent,cookie,record,readPurchases,secret,summarize} from '../netlify/functions/traffic/lib/core.mjs';
import login from '../netlify/functions/dashboard-login.mjs';
import data from '../netlify/functions/dashboard-data.mjs';
const sid='12345678-1234-1234-1234-123456789abc',eid='22345678-1234-1234-1234-123456789abc';
const now=Date.now(),key='unit-test-only-password-1234';
test('auth fails closed; signed cookie expires and cannot be forged',async()=>{
  assert.equal(secret({TOONCLIPZ_DASHBOARD_PASSWORD:'short'}),null);
  const request=new Request('https://site.test',{headers:{cookie:cookie(key,now).split(';')[0]}});
  assert.equal(authorized(request,key,now),true);assert.equal(authorized(request,'wrong',now),false);assert.equal(authorized(request,key,now+43200001),false);
  process.env.TOONCLIPZ_DASHBOARD_PASSWORD=key;
  try{
    assert.equal((await data(new Request('https://site.test'))).status,401);
    assert.equal((await login(new Request('https://site.test',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}))).status,403);
    const make=password=>new Request('https://site.test',{method:'POST',headers:{origin:'https://site.test'},body:JSON.stringify({password})});
    assert.equal((await login(make('wrong'))).status,401);
    const r=await login(make(key));assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);
  }finally{delete process.env.TOONCLIPZ_DASHBOARD_PASSWORD;}
});
test('public events cannot forge purchases or persist personal fields',()=>{
  assert.equal(cleanEvent({id:eid,session:sid,type:'purchase'},now),null);
  assert.equal(cleanEvent({id:eid,session:sid,type:'__proto__'},now),null);
  const e=cleanEvent({id:eid,session:sid,type:'page_view',source:'instagram',email:'private@example.com',url:'?session_id=secret',device:'mobile'},now);
  assert.deepEqual(Object.keys(e).sort(),['at','device','id','session','source','type']);assert.equal(e.at,now);
});
test('retries are deduplicated and optimistic writes preserve concurrent events',async()=>{
  let row=null,version=0,conflict=true;
  const store={getWithMetadata:async()=>row?{data:structuredClone(row),etag:String(version)}:null,setJSON:async(k,r,o)=>{if(conflict){conflict=false;return {modified:false};}row=structuredClone(r);version++;return {modified:true};}};
  const e=cleanEvent({id:eid,session:sid,type:'page_view',source:'instagram'},now);await record(store,e);await record(store,e);assert.equal(row.events.length,1);
  await record(store,{...e,id:'32345678-1234-1234-1234-123456789abc',type:'checkout'});assert.equal(row.events.length,2);
  const s=summarize([row],now-1000,now);assert.equal(s.sessions,1);assert.equal(s.pageViews,1);assert.equal(s.steps.checkout,1);assert.equal(s.recent,1);
  assert.equal(summarize([row],now+1,now+1000).sessions,0);
});
test('Stripe counts only paid live $25 store checkouts, deducts refunds, paginates and returns no PII',async()=>{
  const base={id:'cs_live_1',livemode:true,mode:'payment',status:'complete',payment_status:'paid',payment_link:'plink_store',currency:'usd',amount_subtotal:2500,amount_total:2700,created:Math.floor(now/1000),customer_email:'secret@example.com',payment_intent:{latest_charge:{amount_refunded:0}}};
  let calls=0;
  const fetcher=async url=>{calls++;if(calls===2)assert.equal(url.searchParams.get('starting_after'),'cs_live_last');return Response.json(calls===1?{has_more:true,data:[base,{...base,livemode:false},{...base,amount_subtotal:100},{...base,payment_link:'wrong'},{...base,status:'open'},{...base,id:'cs_live_last',payment_status:'unpaid'}]}:{has_more:false,data:[{...base,payment_intent:{latest_charge:{amount_refunded:2700}}}]});};
  const p=await readPurchases({STRIPE_SECRET_KEY:'placeholder',STRIPE_PAYMENT_LINK_IDS:'plink_store'},now-1000,fetcher);
  assert.equal(calls,2);assert.equal(p.count,1);assert.equal(p.gross,5400);assert.equal(p.refunds,2700);assert.ok(!JSON.stringify(p).includes('secret@'));
  assert.equal((await readPurchases({},now)).available,false);
  await assert.rejects(readPurchases({STRIPE_SECRET_KEY:'placeholder',STRIPE_PAYMENT_LINK_IDS:'plink_store'},now,async()=>new Response('',{status:401})));
});
