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
  const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,{textContent:'',hidden:true,href:'',style:{},scrollIntoView(){this.scrolled=true;},removeAttribute(name){delete this[name];},addEventListener(event,handler){this[event]=handler;}}]));
  const sessionStore=options.sessionStore??new Map(),localStore=options.localStore??new Map();
  const location={search:options.search??'?session_id='+checkout,pathname:'/payment-confirmation.html'};
  const history={state:options.historyState??null,replaceState(state,_title,path){this.state=state;this.path=path;location.search='';}};
  const events=[],requests=[],resizeObservers=[];
  const window={navigator:{globalPrivacyControl:options.gpc===true},toonclipzAnalyticsConsent:options.analyticsConsent,fbq:(...args)=>events.push(['meta',...args]),ttq:{_i:{DAN48FRC77U1ARFV6OF0:[]},track:(...args)=>events.push(['tiktok',...args])}};
  if(options.resizeObserver)window.ResizeObserver=class {
    constructor(callback){this.callback=callback;this.disconnected=false;resizeObservers.push(this);}
    observe(target){this.target=target;}
    disconnect(){this.disconnected=true;}
    notify(){if(!this.disconnected)this.callback([{target:this.target}]);}
  };
  const context={document:{getElementById:id=>nodes[id]},location,history,window,sessionStorage:storage(sessionStore,options.storageDisabled),localStorage:storage(localStore,options.storageDisabled),URLSearchParams,Intl,console,
    fetch:async(url,request)=>{requests.push({url,...request});if(options.fetchResponse)return options.fetchResponse(requests.length);if(options.networkError)throw new Error('Network unavailable');return {ok:!options.serverError,json:async()=>options.payment??paid};}};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,events,requests,history,location,sessionStore,localStore,resizeObservers};
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

test('deposit confirmation reports only $5, explains balance, and offers upload after verified payment',async()=>{
 const page=await render({payment:{...paid,deposit:true,duration:null,amount:500,reference:'TC-D60-order'}});
 assert.equal(page.nodes.title.textContent,'Your $5 deposit is confirmed!');
 assert.match(page.nodes.packageSummary.textContent,/\$85 remaining/);
 assert.equal(page.nodes.uploadMaterials.href,'/submit/?ref=TC-D60-order');
 assert.equal(page.nodes.uploadMaterials.hidden,false);
 const purchase=page.events.find(e=>e[0]==='meta'&&e[2]==='Purchase');
 assert.equal(purchase[3].value,5);assert.equal(purchase[3].content_name,'ToonClipz $5 Video Deposit');
});



test('verified live deposits immediately show the existing paid form with the same reference',async()=>{
 for(const reference of ['TC-D-example','TC-D30-example','TC-D60-example','TC-D180-example']){
  const page=await render({payment:{...paid,deposit:true,amount:500,reference}});
  assert.equal(page.nodes.paidIntake.hidden,false);
  assert.equal(page.nodes.materialsFrame.src,'/submit/?ref='+reference+'&embedded=1');
  assert.equal(page.nodes.openIntake.href,'/submit/?ref='+reference);
  assert.equal(page.nodes.uploadMaterials.href,page.nodes.openIntake.href);
  assert.equal(page.events.filter(e=>e[0]==='meta'&&e[2]==='Purchase').length,1);
  assert.equal(page.events.filter(e=>e[0]==='tiktok'&&e[1]==='Purchase').length,1);
  assert.ok(!page.nodes.materialsFrame.src.includes(checkout));
 }
 assert.ok(html.indexOf('id="paidIntake"')<html.indexOf('id="details"'),'form appears before the receipt details');
});

test('pending, invalid, test, refunded and failed verifications never open the paid form',async()=>{
 for(const options of [
  {payment:{paid:false,status:'pending',deposit:true}},
  {payment:{paid:false,status:'expired',deposit:true}},
  {payment:{...paid,deposit:true,test:true}},
  {payment:{...paid,deposit:true,refunded:true}},
  {payment:{...paid,deposit:true,reference:'https://wrong.example'}},
  {payment:paid},{search:''},{search:'?session_id=bad'},{networkError:true},{serverError:true}
 ]){
  const page=await render(options);
  assert.equal(page.nodes.paidIntake.hidden,true);
  assert.equal(page.nodes.materialsFrame.src,undefined);
 }
});

test('deposit form fits changing content without an inner scrollbar, with a full-page fallback',async()=>{
 const page=await render({payment:{...paid,deposit:true,reference:'TC-D-example'}});
 const frame=page.nodes.materialsFrame;
 frame.contentDocument={body:{getBoundingClientRect:()=>({height:1400})},getElementById:id=>id==='materialsForm'?{}:null};
 frame.onload();assert.equal(frame.style.height,'1432px');assert.equal(page.nodes.paidIntake.scrolled,true);
 frame.contentDocument=null;frame.onload();
 assert.equal(page.nodes.openIntake.href,'/submit/?ref=TC-D-example');
});

test('refresh verifies a deposit again and reconstructs its form without a duplicate Purchase',async()=>{
 const payment={...paid,deposit:true,reference:'TC-D-example'};
 const first=await render({payment});
 const second=await render({payment,search:'',sessionStore:first.sessionStore,localStore:first.localStore});
 assert.equal(second.requests.length,1);assert.equal(second.nodes.paidIntake.hidden,false);assert.deepEqual(second.events,[]);
 const refunded=await render({payment:{...payment,refunded:true},search:'',sessionStore:first.sessionStore});
 assert.equal(refunded.nodes.paidIntake.hidden,true);assert.equal(refunded.nodes.materialsFrame.src,undefined);
});


function intakeDocument(height=1400){
 const layout={height};
 const body={getBoundingClientRect:()=>({height:layout.height})};
 return {layout,body,getElementById:id=>id==='materialsForm'?{}:null};
}

test('ResizeObserver follows expanding and shrinking intake content and disconnects on navigation',async()=>{
 const page=await render({payment:{...paid,deposit:true,reference:'TC-D-example'},resizeObserver:true});
 const frame=page.nodes.materialsFrame,doc=intakeDocument(1400.25);
 frame.contentDocument=doc;frame.onload();
 assert.equal(frame.style.height,'1433px','fractional content height rounds upward');
 assert.equal(page.resizeObservers.length,1);
 const observer=page.resizeObservers[0];
 assert.equal(observer.target,doc.body);
 doc.layout.height=1850.5;observer.notify();
 assert.equal(frame.style.height,'1883px','song picker and validation expansion resize the frame');
 doc.layout.height=450;observer.notify();
 assert.equal(frame.style.height,'482px','completion or collapsed content shrinks the frame');
 frame.contentDocument=null;frame.onload();
 assert.equal(observer.disconnected,true);
 doc.layout.height=900;observer.notify();
 assert.equal(frame.style.height,'482px','disconnected old document cannot resize the frame');
 const next=intakeDocument(800);
 frame.contentDocument=next;frame.onload();
 assert.equal(frame.style.height,'832px');
 assert.equal(page.resizeObservers.length,2);
 assert.equal(page.resizeObservers[1].target,next.body);
});

test('blank, error and inaccessible frame loads retain fallback and recover on a valid load',async()=>{
 const page=await render({payment:{...paid,deposit:true,reference:'TC-D60-example'},resizeObserver:true});
 const frame=page.nodes.materialsFrame,load=frame.onload;
 const blank={body:null,getElementById:()=>null};
 const error={body:{getBoundingClientRect:()=>({height:100})},getElementById:()=>null};
 for(const doc of [null,blank,error]){
  frame.contentDocument=doc;frame.onload();
  assert.equal(frame.onload,load,'an unsuccessful load must not consume the handler');
  assert.equal(page.resizeObservers.length,0);
  assert.equal(page.nodes.paidIntake.scrolled,undefined);
  assert.equal(page.nodes.openIntake.href,'/submit/?ref=TC-D60-example');
 }
 Object.defineProperty(frame,'contentDocument',{configurable:true,get(){throw new Error('Access denied');}});
 assert.doesNotThrow(()=>frame.onload());
 assert.equal(page.nodes.openIntake.href,'/submit/?ref=TC-D60-example');
 Object.defineProperty(frame,'contentDocument',{configurable:true,writable:true,value:intakeDocument(900)});
 frame.onload();
 assert.equal(frame.style.height,'932px');
 assert.equal(page.nodes.paidIntake.scrolled,true);
 assert.equal(page.resizeObservers.length,1);
});

test('failed or pending payment retries await verification before showing the intake',async()=>{
 for(const first of ['network','pending']){
  let finishRetry;
  const payment={...paid,deposit:true,reference:'TC-D30-example'};
  const page=await render({resizeObserver:true,fetchResponse:async attempt=>{
   if(attempt===1){
    if(first==='network')throw new Error('Network unavailable');
    return {ok:true,json:async()=>({paid:false,status:'pending'})};
   }
   return new Promise(resolve=>{finishRetry=()=>resolve({ok:true,json:async()=>payment});});
  }});
  assert.equal(page.nodes.retry.hidden,false);
  assert.equal(page.nodes.paidIntake.hidden,true);
  assert.equal(page.nodes.materialsFrame.src,undefined);
  const retry=page.nodes.retry.click();
  assert.equal(page.nodes.retry.hidden,true);
  assert.equal(page.nodes.paidIntake.hidden,true,'form stays hidden while verification is in flight');
  assert.equal(page.nodes.materialsFrame.src,undefined);
  finishRetry();await retry;
  assert.equal(page.requests.length,2);
  assert.equal(page.nodes.paidIntake.hidden,false);
  assert.equal(page.nodes.materialsFrame.src,'/submit/?ref=TC-D30-example&embedded=1');
  page.nodes.materialsFrame.contentDocument=null;page.nodes.materialsFrame.onload();
  page.nodes.materialsFrame.contentDocument=intakeDocument(1000);page.nodes.materialsFrame.onload();
  assert.equal(page.nodes.materialsFrame.style.height,'1032px');
  assert.equal(page.resizeObservers.length,1);
 }
});

test('reverification disconnects the prior observer and replaces the frame handler without duplicate purchases',async()=>{
 const options={payment:{...paid,deposit:true,reference:'TC-D-example'},resizeObserver:true};
 const page=await render(options),frame=page.nodes.materialsFrame;
 frame.contentDocument=intakeDocument();frame.onload();
 const observer=page.resizeObservers[0],oldLoad=frame.onload;
 const retry=page.nodes.retry.click();
 assert.equal(observer.disconnected,true);
 assert.equal(page.nodes.paidIntake.hidden,true);
 assert.equal(frame.src,undefined);
 await retry;
 assert.notEqual(frame.onload,oldLoad);
 frame.contentDocument=intakeDocument(1200);frame.onload();
 assert.equal(frame.style.height,'1232px');
 assert.equal(page.resizeObservers.length,2);
 assert.equal(page.events.filter(e=>e[0]==='meta'&&e[2]==='Purchase').length,1);
 assert.equal(page.events.filter(e=>e[0]==='tiktok'&&e[1]==='Purchase').length,1);
 options.payment={...options.payment,refunded:true};
 await page.nodes.retry.click();
 assert.equal(page.resizeObservers[1].disconnected,true);
 assert.equal(page.nodes.paidIntake.hidden,true);
 assert.equal(frame.src,undefined);
});


test('matched materials-first deposits confirm the saved order without asking for duplicate materials',async()=>{
 const page=await render({payment:{...paid,deposit:true,reference:'TC-D30-order',orderReady:true,needsOrderMatch:true}});
 assert.equal(page.nodes.paidIntake.hidden,true);assert.equal(page.nodes.materialsFrame.src,undefined);assert.match(page.nodes.title.textContent,/deposit and materials/);assert.match(page.nodes.next.textContent,/24–72 hours/);assert.match(page.nodes.uploadMaterials.textContent,/optional/);
});

test('paid material matching outages offer retry and never claim the order is ready or request duplicate uploads',async()=>{
 const page=await render({payment:{...paid,deposit:true,reference:'TC-D30-order',orderReady:false,needsOrderMatch:true,depositOrderStatus:'unavailable'}});
 assert.equal(page.nodes.paidIntake.hidden,true);assert.equal(page.nodes.retry.hidden,false);assert.match(page.nodes.message.textContent,/still matching/);assert.match(page.nodes.message.textContent,/Do not pay again/);
});
