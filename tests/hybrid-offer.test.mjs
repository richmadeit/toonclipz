import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
const source=html.slice(html.indexOf('/* ---------- offer selection'),html.indexOf('\nupdateOffer();\ntally();'));
function setup(preview,{valid=true,fail=false}={}){
 const els=new Map(),events=[],inserts=[],redirects=[];let submit;
 function $(id){if(!els.has(id))els.set(id,{value:({email:'test@example.com',mood:'Emotional',ts:'0:00',te:'0:30',name:'Test',creativeIdea:''})[id]||'',style:{},dataset:{},querySelector:()=>({style:{}}),addEventListener:(name,fn)=>{if(id==='f'&&name==='submit')submit=fn;},setAttribute(){},setCustomValidity(message){this.validationMessage=message;},focus(){},scrollIntoView(){}});return els.get(id);}
 const radio={value:preview?'preview':'upfront'};
 const ctx=vm.createContext({$,document:{querySelector:()=>radio,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},location:{assign:url=>redirects.push(url)},toonclipzActivity:t=>events.push(t),fbq:(...a)=>events.push(a),ttq:{track:(...a)=>events.push(a)}},navigator:{},URL,console:{error(){}},Math,submitting:false,validateBrief:()=>valid,tally(){},rmiTrackBuildClick(){},rmiTrackSuccessfulLead:()=>events.push('saved'),selectedStyleName:()=> 'Cinematic 3D',photos:[{name:'1.jpg'},{name:'2.jpg'},{name:'3.jpg'}],song:{name:'song.mp3'},audioEl:null,BUCKET:'test',previewSource:'toonclipz',trafficSource:'direct',trafficCampaign:'direct',TOONCLIPZ_STORAGE_STYLE:'cartoon',sb:{storage:{from:()=>({upload:async()=>({error:null})})},from:()=>({insert:async row=>{inserts.push(row);return {error:fail?new Error('save failed'):null};}})}});
 vm.runInContext(source,ctx);return {$,events,inserts,redirects,ctx,radio,submit:()=>submit({preventDefault(){}})};
}
test('preview saves required materials and unlock offer, confirms request with no checkout or purchase',async()=>{
 const h=setup(true);await h.submit();assert.equal(h.inserts.length,1);assert.equal(h.inserts[0].photo_paths.length,3);assert.match(h.inserts[0].contact,/\$60 preview-first/);assert.match(h.inserts[0].contact,/NOT REQUIRED FOR PREVIEW/);assert.equal(h.redirects.length,0);assert.equal(h.$('checkoutLink').hidden,true);assert.match(h.$('receiptStatus').textContent,/No payment is due/);assert.deepEqual(h.events,['saved']);
});
test('upfront saves order and sends $60 checkout with order reference and product ID',async()=>{
 const h=setup(false);await h.submit();assert.match(h.inserts[0].contact,/\$60 upfront/);const url=new URL(h.redirects[0]);assert.equal(url.pathname,'/dRm4gA5AF0yH23B9fl2wU04');assert.equal(url.searchParams.get('client_reference_id'),h.inserts[0].ref);assert.equal(h.events.filter(x=>Array.isArray(x)&&x.includes('Purchase')).length,0);assert.equal(h.events.at(-1)[1].contents[0].content_id,'toonclipz-30-second');
});
test('invalid brief and save failure cannot confirm or redirect either offer',async()=>{
 for(const preview of [true,false])for(const options of [{valid:false},{fail:true}]){const h=setup(preview,options);await h.submit();assert.equal(h.redirects.length,0);assert.equal(h.events.includes('saved'),false);assert.notEqual(h.$('receipt').style.display,'block');}
});

test('profile required only for preview and whitespace cannot satisfy it; switching clears requirement',()=>{
 const h=setup(true);h.ctx.updateOffer();assert.equal(h.$('socialProfile').required,true);assert.equal(h.ctx.validateSocialProfile(),false);
 h.$('socialProfile').value='   ';assert.equal(h.ctx.validateSocialProfile(),false);
 for(const value of ['Instagram @artist','TikTok @artist','https://www.facebook.com/artist']){h.$('socialProfile').value=value;assert.equal(h.ctx.validateSocialProfile(),true);}
 h.$('socialProfile').value='';h.radio.value='upfront';h.ctx.updateOffer();assert.equal(h.$('socialProfile').required,false);assert.equal(h.$('socialProfile').validationMessage,'');assert.equal(h.ctx.validateSocialProfile(),true);
});
test('provided social profile is retained in the saved order',async()=>{
 const h=setup(true);h.$('socialProfile').value='Facebook @artist';await h.submit();assert.match(h.inserts[0].contact,/Social profile: Facebook @artist/);
});
