import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../payment-confirmation.js',import.meta.url),'utf8');
const html=await readFile(new URL('../payment-confirmation.html',import.meta.url),'utf8');
const checkout='cs_live_abcdefghijklmnop';
const recoveryKey='toonclipz.payment-confirmation';
const paid={paid:true,test:false,refunded:false,duration:180,amount:30000,tax:0,currency:'usd',method:'visa •••• 4242',email:'b•••@example.com',reference:'TC-180-order',eventId:'tc_uniqueorder',receipt:'https://pay.stripe.com/receipts/example'};

function storage(map,unavailable=false){
  return {
    getItem(key){if(unavailable)throw new Error('Storage disabled');return map.get(key)??null;},
    setItem(key,value){if(unavailable)throw new Error('Storage disabled');map.set(key,String(value));},
    removeItem(key){if(unavailable)throw new Error('Storage disabled');map.delete(key);}
  };
}
async function render(options={}){
  const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,{textContent:'',hidden:true,href:'',addEventListener(event,handler){this[event]=handler;}}]));
  const sessionStore=options.sessionStore??new Map(),localStore=options.localStore??new Map();
  const location={search:options.search??'?session_id='+checkout,pathname:'/payment-confirmation.html'};
  const history={state:options.historyState??null,replaceState(state,_title,path){this.state=state;this.path=path;location.search='';}};
  const events=[],requests=[];
  const window={navigator:{globalPrivacyControl:options.gpc===true},toonclipzAnalyticsConsent:options.analyticsConsent,fbq:(...args)=>events.push(['meta',...args]),ttq:{_i:{DAN48FRC77U1ARFV6OF0:[]},track:(...args)=>events.push(['tiktok',...args])}};
  const context={document:{getElementById:id=>nodes[id]},location,history,window,sessionStorage:storage(sessionStore,options.storageDisabled),localStorage:storage(localStore,options.storageDisabled),URLSearchParams,Intl,console,
    fetch:async(url,request)=>{requests.push({url,...request});return {ok:true,json:async()=>options.payment??paid};}};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,events,requests,history,location,sessionStore,localStore};
}

test('confirmation renders each verified package, including the full-video scope without a delivery promise',async()=>{
  for(const duration of [15,30,60,180]){
    const page=await render({payment:{...paid,duration,reference:'TC-'+duration+'-order'}});
    assert.equal(page.nodes.title.textContent,'Payment confirmed. Thank you!');
    assert.equal(page.nodes.details.hidden,false);
    assert.equal(page.nodes.uploadMaterials.hidden,false);
    assert.equal(page.nodes.uploadMaterials.href,'/submit/?ref=TC-'+duration+'-order');
    assert.match(page.nodes.packageSummary.textContent,duration===180?/up to 3 minutes/:new RegExp(duration+'-second'));
    assert.match(page.nodes.packageSummary.textContent,/one artist/);
    assert.equal(page.events.filter(event=>event[0]==='meta'&&event[1]==='track'&&event[2]==='Purchase').length,1);
    if(duration===180){
      assert.match(page.nodes.packageSummary.textContent,/up to six scene concepts/);
      assert.match(page.nodes.packageSummary.textContent,/one minor revision round/);
      assert.match(page.nodes.packageSummary.textContent,/15-second teaser/);
    }
  }
  assert.doesNotMatch(html,/1[–-]6 hours|Your 30-second/);
});

test('unpaid, sandbox and refunded checkouts never emit live purchases or allow order uploads',async()=>{
  for(const payment of [{paid:false,status:'pending'},{paid:false,status:'expired'},{...paid,test:true},{...paid,refunded:true}]){
    const page=await render({payment});
    assert.deepEqual(page.events,[]);
    assert.equal(page.nodes.uploadMaterials.hidden,true);
    if(!payment.paid){assert.equal(page.nodes.details.hidden,true);assert.equal(page.nodes.retry.hidden,false);}
  }
});

test('refresh restores the checkout reference from session storage and verifies Stripe again',async()=>{
  const first=await render();
  assert.equal(first.location.search,'');
  assert.equal(first.history.path,'/payment-confirmation.html');
  const refreshed=await render({search:'',sessionStore:first.sessionStore,localStore:first.localStore});
  assert.equal(JSON.parse(refreshed.requests[0].body).session_id,checkout);
  assert.equal(refreshed.nodes.title.textContent,'Payment confirmed. Thank you!');
  assert.equal(refreshed.nodes.uploadMaterials.hidden,false);
  assert.deepEqual(refreshed.events,[],'a reload must not queue a duplicate purchase');
  const refunded=await render({search:'',sessionStore:first.sessionStore,localStore:first.localStore,payment:{...paid,refunded:true}});
  assert.equal(refunded.requests.length,1,'a stored reference is not stored proof of payment');
  assert.equal(refunded.nodes.title.textContent,'Payment refunded');
  assert.equal(refunded.nodes.uploadMaterials.hidden,true);
});

test('refresh can recover through history state when browser storage is unavailable',async()=>{
  const first=await render({storageDisabled:true});
  const refreshed=await render({search:'',storageDisabled:true,historyState:first.history.state});
  assert.equal(JSON.parse(refreshed.requests[0].body).session_id,checkout);
  assert.equal(refreshed.nodes.title.textContent,'Payment confirmed. Thank you!');
});

test('missing, malformed and expired references never verify or reuse a different checkout',async()=>{
  const valid={session:checkout,expiresAt:Date.now()+60000};
  const cases=[{},
    {search:'?session_id=not-a-checkout',sessionStore:new Map([[recoveryKey,JSON.stringify(valid)]]),historyState:{toonclipzPayment:valid}},
    {sessionStore:new Map([[recoveryKey,JSON.stringify({session:checkout,expiresAt:Date.now()-1000})]])},
    {historyState:{toonclipzPayment:{session:'malformed',expiresAt:Date.now()+60000}}},
    {sessionStore:new Map([[recoveryKey,'not json']])}
  ];
  for(const options of cases){
    const page=await render({search:'',...options});
    assert.equal(page.requests.length,0);
    assert.equal(page.nodes.title.textContent,'Your payment confirmation');
    assert.equal(page.nodes.details.hidden,true);
    assert.deepEqual(page.events,[]);
    assert.equal(page.sessionStore.has(recoveryKey),false);
  }
});


test('privacy opt-out preserves the receipt without emitting Meta Purchase',async()=>{
  for(const options of [{gpc:true},{analyticsConsent:false}]){
    const page=await render(options);assert.equal(page.nodes.title.textContent,'Payment confirmed. Thank you!');assert.equal(page.nodes.uploadMaterials.hidden,false);assert.equal(page.events.filter(event=>event[0]==='meta').length,0);
    if(options.gpc)assert.deepEqual(page.events,[]);
  }
});
