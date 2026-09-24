import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,telegramInvite} from '../netlify/functions/verify-toon-method.mjs';
import {offerConfig} from '../netlify/functions/toon-method-offer.mjs';

const id='cs_live_12345678901234567890';
const env={STRIPE_SECRET_KEY:'test-fixture-not-a-key',TOON_METHOD_PAYMENT_LINK_ID:'plink_method',TOON_METHOD_TELEGRAM_INVITE:'https://t.me/+testInvite',TOON_METHOD_CHECKOUT_URL:'https://buy.stripe.com/exampleMethod',TOON_METHOD_SALES_ENABLED:'true'};
const paid=()=>({id,livemode:true,mode:'payment',payment_link:'plink_method',currency:'usd',amount_subtotal:4900,status:'complete',payment_status:'paid',payment_intent:{status:'succeeded',latest_charge:{paid:true,status:'succeeded',refunded:false,disputed:false,amount_refunded:0}}});
const req=(body={session_id:id},origin='https://toonclipz.netlify.app')=>new Request('https://toonclipz.netlify.app/.netlify/functions/verify-toon-method',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
const handler=(session,overrides={})=>createHandler({env:{...env,...overrides},requestStripe:async()=>new Response(JSON.stringify(session))});

test('verified $49 live payment receives the configured private group URL',async()=>{
  const response=await handler(paid())(req());const data=await response.json();
  assert.equal(response.status,200);assert.equal(data.status,'verified');
  assert.equal(data.telegramUrl,env.TOON_METHOD_TELEGRAM_INVITE);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('without an explicit link ID, only the exact verified Stripe link unlocks access',async()=>{
  for(const [url,expected] of [['https://buy.stripe.com/5kQ14o7INbdlbEbajp2wU05','verified'],['https://buy.stripe.com/dRm4gA5AF0yH23B9fl2wU04','wrong_offer'],['https://evil.example','wrong_offer']]){
    const session={...paid(),payment_link:{id:'plink_actual',url}};
    const data=await (await handler(session,{TOON_METHOD_PAYMENT_LINK_ID:undefined})(req())).json();
    assert.equal(data.status,expected);
    if(expected!=='verified')assert.equal(data.telegramUrl,undefined);
  }
});
test('wrong offer, test mode, unpaid, incomplete, refund, dispute and missing charge never reveal invite',async()=>{
  const fixtures=[
    {...paid(),payment_link:'plink_custom60'}, {...paid(),amount_subtotal:6000}, {...paid(),currency:'eur'},
    {...paid(),livemode:false}, {...paid(),id:'cs_live_unrelated123456'}, {...paid(),mode:'subscription'},
    {...paid(),payment_status:'unpaid'}, {...paid(),status:'open'}, {...paid(),payment_intent:'pi_unexpanded'},
    ...[{refunded:true},{amount_refunded:100},{disputed:true},{status:'failed'},{paid:false}].map(change=>{
      const session=paid();Object.assign(session.payment_intent.latest_charge,change);return session;
    })
  ];
  for(const session of fixtures){
    const data=await (await handler(session)(req())).json();
    assert.notEqual(data.status,'verified');assert.equal(data.telegramUrl,undefined);assert.equal(data.workbookUrl,undefined);
  }
});
test('forged queries, invalid IDs, test IDs and cross-origin requests fail before Stripe',async()=>{
  let calls=0;const h=createHandler({env,requestStripe:async()=>{calls++;throw Error('must not call');}});
  for(const request of [req({paid:true}),req({session_id:'cs_test_12345678901234'}),req({session_id:'../../evil'}),req({session_id:id},'https://other.example'),new Request('https://toonclipz.netlify.app/.netlify/functions/verify-toon-method?paid=true')]){
    const response=await h(request);assert.ok(response.status>=400);assert.ok(!(await response.text()).includes('t.me'));
  }
  assert.equal(calls,0);
});
test('missing configuration and Stripe failure fail closed',async()=>{
  assert.equal((await handler(paid(),{STRIPE_SECRET_KEY:''})(req())).status,503);
  const h=createHandler({env,requestStripe:async()=>{throw Error('offline');}});
  const response=await h(req());assert.equal(response.status,502);assert.ok(!(await response.text()).includes('t.me'));
});
test('verified buyer without invite gets manual delivery fallback, never an unsafe link',async()=>{
  for(const raw of ['', 'https://evil.example/invite','javascript:alert(1)','https://t.me/user','https://t.me/+ok?redirect=evil']){
    assert.equal(telegramInvite(raw),null);
    const data=await (await handler(paid(),{TOON_METHOD_TELEGRAM_INVITE:raw})(req())).json();
    assert.equal(data.status,'verified');assert.equal(data.telegramUrl,null);
  }
});
test('public offer exposes only checkout URL and stays manual until explicitly ready',()=>{
  assert.equal(offerConfig(env).mode,'checkout');
  assert.equal(offerConfig({...env,TOON_METHOD_SALES_ENABLED:''}).mode,'manual');
  assert.equal(offerConfig({...env,TOON_METHOD_TELEGRAM_INVITE:''}).mode,'manual');
  assert.equal(offerConfig({...env,TOON_METHOD_CHECKOUT_URL:'https://evil.example'}).mode,'manual');
  assert.equal(offerConfig({...env,TOON_METHOD_CHECKOUT_URL:'https://buy.stripe.com/test_example'}).mode,'manual');
  assert.ok(!JSON.stringify(offerConfig(env)).includes('testInvite'));
  assert.ok(!JSON.stringify(offerConfig(env)).includes(env.STRIPE_SECRET_KEY));
});


test('paid buyer receives immediate private course access even with no Telegram invite',async()=>{
 let storageCalls=0;
 const h=createHandler({env:{...env,TOON_METHOD_AUTOMATIC_COURSE_ENABLED:'true',TOON_METHOD_STORAGE_KEY:'storage-fixture',TOON_METHOD_TELEGRAM_INVITE:''},requestStripe:async()=>new Response(JSON.stringify(paid())),requestStorage:async(url,options)=>{
  storageCalls++;assert.equal(url,'https://molqlfdjlmnlkscecngz.supabase.co/storage/v1/object/sign/paid-workbooks/Richmadeit-University-Interactive-Workbook.html');
  assert.equal(JSON.parse(options.body).expiresIn,120);
  return new Response(JSON.stringify({signedURL:'/object/sign/paid-workbooks/Richmadeit-University-Interactive-Workbook.html?token=fixture'}));
 }});
 const response=await h(req());const data=await response.json();
 assert.equal(data.course.mode,'automatic');assert.equal(data.telegramUrl,null);assert.equal(storageCalls,1);
 assert.equal(data.course.expiresIn,120);assert.ok(!JSON.stringify(data).includes('storage-fixture'));
});
test('unpaid or refunded buyer never requests a course URL',async()=>{
 for(const session of [{...paid(),payment_status:'unpaid'},{...paid(),payment_link:'plink_wrong'},(()=>{const s=paid();s.payment_intent.latest_charge.refunded=true;return s;})()]){
  let calls=0;
  const h=createHandler({env:{...env,TOON_METHOD_AUTOMATIC_COURSE_ENABLED:'true',TOON_METHOD_STORAGE_KEY:'fixture'},requestStripe:async()=>new Response(JSON.stringify(session)),requestStorage:async()=>{calls++;throw Error('unexpected');}});
  const data=await(await h(req())).json();assert.equal(calls,0);assert.equal(data.course,undefined);
 }
});
test('course storage failures and unsafe URLs never fall back to approval or leak keys',async()=>{
 for(const raw of ['https://evil.example/object?token=x','/object/sign/other/file.html?token=x','/object/sign/paid-workbooks/Richmadeit-University-Interactive-Workbook.html',null]){
  const h=createHandler({env:{...env,TOON_METHOD_AUTOMATIC_COURSE_ENABLED:'true',TOON_METHOD_STORAGE_KEY:'private-fixture'},requestStripe:async()=>new Response(JSON.stringify(paid())),requestStorage:async()=>new Response(JSON.stringify({signedURL:raw}))});
  const data=await(await h(req())).json();assert.equal(data.status,'verified');assert.equal(data.course.mode,'unavailable');assert.equal(data.workbookUrl,null);assert.ok(!JSON.stringify(data).includes('private-fixture'));
 }
});
