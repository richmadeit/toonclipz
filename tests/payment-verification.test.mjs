import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/verify-payment.mjs';
const request=id=>new Request('https://toonclipz.netlify.app/.netlify/functions/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:id})});
test('verification fails closed and separates paid, pending, wrong-store and sandbox payments',async()=>{
  const oldFetch=globalThis.fetch;
  const id='cs_test_abcdefghijklmnop';
  assert.equal((await handler(request('bad'))).status,400);
  assert.equal((await handler(request(id))).status,503);
  process.env.STRIPE_TEST_SECRET_KEY='test-only-placeholder';
  process.env.STRIPE_TEST_PAYMENT_LINK_IDS='plink_allowed';
  let s={livemode:false,mode:'payment',payment_link:'plink_allowed',status:'complete',payment_status:'paid',amount_total:2500,currency:'usd',customer_details:{email:'buyer@example.com'},payment_intent:{latest_charge:{payment_method_details:{card:{brand:'visa',last4:'4242'}},receipt_url:'https://pay.stripe.com/receipts/example'}}};
  globalThis.fetch=async()=>Response.json(s);
  try{
    let r=await (await handler(request(id))).json();assert.equal(r.paid,true);assert.equal(r.test,true);assert.equal(r.amount,2500);assert.equal(r.email,'b•••@example.com');assert.equal(r.method,'visa •••• 4242');assert.ok(!JSON.stringify(r).includes('buyer@'));
    s.payment_status='unpaid';r=await(await handler(request(id))).json();assert.equal(r.paid,false);assert.equal(r.receipt,undefined);
    s.payment_status='paid';s.payment_link='plink_wrong';assert.equal((await handler(request(id))).status,404);
    s.payment_link='plink_allowed';s.livemode=true;assert.equal((await handler(request(id))).status,404);
    globalThis.fetch=async()=>{throw new Error('secret-bearing upstream failure')};r=await handler(request(id));assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret-bearing'));
  }finally{globalThis.fetch=oldFetch;delete process.env.STRIPE_TEST_SECRET_KEY;delete process.env.STRIPE_TEST_PAYMENT_LINK_IDS;}
});

test('new live mic-drop link is verified from Stripe expansion; unrelated and sandbox links are rejected',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.STRIPE_SECRET_KEY;
 process.env.STRIPE_SECRET_KEY='test-only-placeholder';
 let s={livemode:true,mode:'payment',status:'complete',payment_status:'paid',amount_total:6000,currency:'usd',payment_link:{id:'plink_new',url:'https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04'}};
 globalThis.fetch=async url=>{assert.ok(url.searchParams.getAll('expand[]').includes('payment_link'));return Response.json(s);};
 try{
  const id='cs_live_abcdefghijklmnop';
  let r=await(await handler(request(id))).json();assert.equal(r.paid,true);assert.equal(r.amount,6000);
  s.payment_link.url='https://buy.stripe.com/unrelated';assert.equal((await handler(request(id))).status,404);
  s.payment_link.url='https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04';s.livemode=false;assert.equal((await handler(request(id))).status,404);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;}
});

test('GTA packages verify exact subtotal and currency and return the paid duration',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.STRIPE_SECRET_KEY;
 process.env.STRIPE_SECRET_KEY='test-only-placeholder';
 const offers=[[15,2500,'https://buy.stripe.com/4gM4gAd37ftB23B8bh2wU06'],[30,5000,'https://buy.stripe.com/bJe7sM6EJa9h6jR2QX2wU07'],[60,9900,'https://buy.stripe.com/9B6dRa4wB0yH6jRfDJ2wU08'],[180,30000,'https://buy.stripe.com/8x2aEY1kpchp9w3bnt2wU09']];
 let s;globalThis.fetch=async()=>Response.json(s);
 try{for(const [duration,amount,url]of offers){
  s={livemode:true,mode:'payment',status:'complete',payment_status:'paid',amount_total:amount,amount_subtotal:amount,currency:'usd',payment_link:{url}};
  let r=await(await handler(request('cs_live_abcdefghijklmnop'))).json();assert.equal(r.paid,true);assert.equal(r.duration,duration);assert.ok(r.reference.startsWith('TC-'+duration+'-'));
  s.amount_subtotal=amount-1;assert.equal((await handler(request('cs_live_abcdefghijklmnop'))).status,404);
  s.amount_subtotal=amount;s.currency='eur';assert.equal((await handler(request('cs_live_abcdefghijklmnop'))).status,404);
 }}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;}
});
