import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const html=readFileSync(new URL('./fixtures/legacy-packages.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../gta-offers.js',import.meta.url),'utf8');
const fullOffers={
  '30':{price:50,url:'https://buy.stripe.com/3cI5kE7INepxdMj1MT2wU0m'},
  '60':{price:90,url:'https://buy.stripe.com/6oU7sM4wB0yHgYv1MT2wU0n'},
  '180':{price:250,url:'https://buy.stripe.com/4gM9AUaUZdltcIf3V12wU0o'},
};
const depositUrl='https://buy.stripe.com/eVqdRabZ33KTdMjfDJ2wU0b';

function checkoutAnchors(){
  return [...html.matchAll(/<a\b([^>]*\bclass="[^"]*\b(?:checkout|deposit-start)\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)].map(match=>{
    const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
    return {attrs,text:match[2],dataset:{tier:attrs['data-tier'],payment:attrs['data-payment']},href:attrs.href.replaceAll('&amp;','&'),listeners:{},removeAttribute(name){delete this.attrs[name]},addEventListener(name,callback){(this.listeners[name]??=[]).push(callback)}};
  });
}

function run({gpc=false,consent=true}={}){
  const links=checkoutAnchors(),events=[],status={textContent:''};
  const context={
    document:{querySelectorAll(selector){return selector==='.checkout'?links.filter(x=>x.attrs.class.split(' ').includes('checkout')):[]},getElementById(id){return id==='checkoutStatus'?status:null}},
    crypto:webcrypto,URL,Uint8Array,matchMedia:()=>({matches:false}),navigator:{globalPrivacyControl:gpc},
    window:{toonclipzAnalyticsConsent:consent},fbq:(...args)=>events.push(args),
  };
  vm.runInNewContext(script,context);
  return {links,events,status};
}

test('each package starts with materials for its $5 preview and retains the original full-pay route',()=>{
  const links=checkoutAnchors();
  assert.equal(links.length,6);
  for(const [tier,offer] of Object.entries(fullOffers)){
    const matches=links.filter(x=>x.dataset.tier===tier);
    assert.equal(matches.length,2);
    assert.match(matches[0].attrs.class,/deposit-start/);
    assert.equal(matches[0].href,'/submit/?tier='+tier+'&checkout=deposit');
    assert.equal(matches[1].href,offer.url);
    assert.match(html,new RegExp('id="depositTerms'+tier+'">Send materials first, then pay \\$5.<br>\\$'+(offer.price-5)+' remaining after preview approval'));
  }
  assert.equal(html.includes(depositUrl),false,'sales page must not bypass materials with a direct deposit link');
});

test('full-payment binding never rewrites deposit intake links',()=>{
  const {links}=run();
  const full=links.filter(x=>x.attrs.class.split(' ').includes('checkout'));
  const deposits=links.filter(x=>x.attrs.class.split(' ').includes('deposit-start'));
  for(const link of deposits){
    assert.equal(link.href,'/submit/?tier='+link.dataset.tier+'&checkout=deposit');
    assert.equal(link.listeners.click,undefined);
  }
  const references=full.map(link=>new URL(link.href).searchParams.get('client_reference_id'));
  assert.equal(new Set(references).size,3);
  for(const link of full){
    const url=new URL(link.href);
    assert.equal(url.origin+url.pathname,fullOffers[link.dataset.tier].url);
    assert.match(url.searchParams.get('client_reference_id'),new RegExp('^TC-'+link.dataset.tier+'-[a-f0-9]{16}$'));
    const original=url.href;
    for(const fn of link.listeners.click||[])fn();
    for(const fn of link.listeners.click||[])fn();
    assert.equal(link.href,original,'repeated clicks preserve the same order reference');
  }
});

test('only actual full-price Stripe checkout clicks trigger InitiateCheckout on sales page',()=>{
  const {links,events}=run();
  for(const link of links)for(const fn of link.listeners.click||[])fn();
  assert.equal(events.length,3);
  const full=links.filter(x=>x.attrs.class.split(' ').includes('checkout'));
  full.forEach((link,index)=>{
    const [action,event,data]=events[index];
    assert.equal(action,'track');assert.equal(event,'InitiateCheckout');
    assert.equal(data.value,fullOffers[link.dataset.tier].price);
    assert.equal(data.currency,'USD');
    assert.equal(data.content_ids[0],'gta-'+link.dataset.tier);
  });
});

test('checkout tracking still honors GPC and explicit no-consent',()=>{
  for(const options of [{gpc:true},{consent:false}]){
    const {links,events}=run(options);
    for(const link of links)for(const fn of link.listeners.click||[])fn();
    assert.equal(events.length,0);
  }
});

test('copy explains the materials-first path, screen recordings and authorized timing',()=>{
  assert.doesNotMatch(html,/Instagram messages only|DM @toon_clipz_ for the \$5|For Instagram deposit|message us on Instagram first|\$5 Preview · DM/i);
  assert.match(html,/screen recording with sound/i);
  assert.match(html,/send your song and animal idea first, then pay the deposit/i);
  assert.doesNotMatch(html,/Send your song and animal idea after payment/i);
  assert.match(html,/up to 50 MB/);
  assert.match(html,/No Instagram message needed/);
  assert.match(html,/class="floating-buy" href="#packages" aria-label="Choose your video and start with a \$5 preview"/);
  assert.match(html,/Your \$5 counts toward the total/);
  assert.equal((html.match(/class="small package-timing">Same-day preview after deposit \+ required materials/g)||[]).length,3);
  assert.equal((html.match(/Full video: 24–72 hours after full payment \+ required materials/g)||[]).length,3);
});
