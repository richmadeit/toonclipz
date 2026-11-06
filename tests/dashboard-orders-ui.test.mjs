import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../status.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../status.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const activity={traffic:{recent:0,pageViews:0,sessions:0,hours:[],steps:{},sources:[],timeline:[]},purchases:{available:true,count:0,gross:0,refunds:0},updatedAt:Date.now(),since:Date.now()-86400000};
const order={reference:'TC-D60-12345678-1234-4123-8123-123456789abc',artistName:'<img src=x onerror=alert(1)>',email:'synthetic@example.test',tier:60,photoCount:1,hasSongFile:true,startTime:'0:10',endTime:'0:25',paidAt:Date.now()};
const result={available:true,orders:[order],checkedAt:Date.now(),unmatched:1,needsReview:1,truncated:false};
function setup(){
 const els=new Map(),events={},state={error:false,signedIn:true,delay:false,deferred:null,calls:[],interval:null};
 function element(id){return {id,children:[],textContent:'',hidden:false,disabled:false,value:id==='range'?'24h':'',style:{},listeners:{},attributes:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=[...items];},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(name,value){this.attributes[name]=value;}};}
 const el=id=>{if(!els.has(id))els.set(id,element(id));return els.get(id);};
 const document={hidden:false,title:'',getElementById:el,createElement:tag=>element(tag),addEventListener:(name,fn)=>events[name]=fn};
 const fetch=async(path)=>{state.calls.push(path);if(path.startsWith('/.netlify/functions/dashboard-login')){state.signedIn=false;return Response.json({ok:true});}if(!state.signedIn)return Response.json({error:'Please sign in.'},{status:401});if(path.includes('dashboard-orders')){if(state.delay)return new Promise(resolve=>state.deferred=()=>resolve(Response.json(result)));return state.error?Response.json({error:'Cannot verify. This is not an empty queue.'},{status:503}):Response.json(result);}return Response.json(activity);};
 const context=vm.createContext({document,fetch,URLSearchParams,location:{search:'',pathname:'/status.html'},history:{replaceState(){}},localStorage:{getItem(){return null;},setItem(){}},setInterval:fn=>state.interval=fn,Intl,Date,Promise});
 vm.runInContext(source,context);
 return {el,document,state,events};
}
test('owner queue renders matching refs and contacts as text, with warning and no external fetch',async()=>{
 const h=setup();await tick();assert.equal(h.el('depositCount').textContent,'1 matched');assert.equal(h.el('depositOrders').children.length,1);assert.match(h.el('depositOrders').children[0].children[0].textContent,/<img/);assert.ok(!h.state.calls.some(x=>!x.startsWith('/.netlify/functions/')));assert.match(h.el('depositStatus').textContent,/manual review/);assert.match(h.document.title,/\(1\)/);
 assert.ok(!source.includes('innerHTML'));assert.match(html,/does not send background, email or text alerts/);
});
test('verification failure clears stale paid cards and successful retry restores them',async()=>{
 const h=setup();await tick();h.state.error=true;await h.el('refresh').listeners.click();assert.equal(h.el('depositOrders').children.length,0);assert.equal(h.el('depositCount').textContent,'Unavailable');assert.match(h.el('depositStatus').textContent,/not an empty queue/);
 h.state.error=false;await h.el('refresh').listeners.click();assert.equal(h.el('depositOrders').children.length,1);
});
test('brand switch hides and clears private deposit details and hidden tabs do not poll',async()=>{
 const h=setup();await tick();h.el('showRichmadeit').listeners.click();await tick();assert.equal(h.el('depositPanel').hidden,true);assert.equal(h.el('depositOrders').children.length,0);
 h.el('showToonclipz').listeners.click();await tick();assert.equal(h.el('depositPanel').hidden,false);assert.equal(h.el('depositOrders').children.length,1);
 const count=h.state.calls.length;h.document.hidden=true;h.state.interval();await tick();assert.equal(h.state.calls.length,count);
 h.document.hidden=false;h.events.visibilitychange();await tick();assert.ok(h.state.calls.length>count);
});
test('repeated refresh and late results after logout cannot duplicate calls or reopen customer data',async()=>{
 const h=setup();await tick();h.state.delay=true;const pending=h.el('refresh').listeners.click();await tick();const count=h.state.calls.length;await h.el('refresh').listeners.click();assert.equal(h.state.calls.length,count);assert.equal(h.el('range').disabled,true);
 await h.el('logout').listeners.click();assert.equal(h.el('dashboard').hidden,true);assert.equal(h.el('depositOrders').children.length,0);h.state.deferred();await pending;assert.equal(h.el('dashboard').hidden,true);assert.equal(h.el('depositOrders').children.length,0);assert.equal(h.el('range').disabled,false);
});
