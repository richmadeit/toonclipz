import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../payment-confirmation.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function tiktokPurchase'),source.indexOf('function purchase('));
function setup({gpc=false,consent=true}={}){
 const events=[],values=new Map([['toonclipz.purchase.order1','queued']]);
 const window={navigator:{globalPrivacyControl:gpc},toonclipzTikTokConsent:consent,ttq:{_i:{DAN48FRC77U1ARFV6OF0:[]},track:(...args)=>events.push(args)}};
 const ctx=vm.createContext({window,console,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
 vm.runInContext(fn,ctx);return {events,send:p=>ctx.tiktokPurchase(p)};
}
const paid={paid:true,test:false,refunded:false,eventId:'order1',amount:2500,currency:'usd'};
test('verified purchase sends actual value, currency and stable ID once, independently of Meta',()=>{
 const h=setup();h.send(paid);h.send(paid);
 assert.equal(h.events.length,1);assert.equal(h.events[0][0],'Purchase');
 assert.equal(h.events[0][1].value,25);assert.equal(h.events[0][1].currency,'USD');
 assert.equal(h.events[0][2].event_id,'order1');
});
test('unpaid, sandbox, refunded, missing ID and denied consent do not send',()=>{
 for(const override of [{paid:false},{test:true},{refunded:true},{eventId:''}]){
  const h=setup();h.send({...paid,...override});assert.equal(h.events.length,0);
 }
 for(const options of [{gpc:true},{consent:false}]){
  const h=setup(options);h.send(paid);assert.equal(h.events.length,0);
 }
});
