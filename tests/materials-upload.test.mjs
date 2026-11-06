import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../order.js',import.meta.url),'utf8');
function setup({insertError=null,storageError=null,reference='TC-180-example',photo=true,song=true,selection={start:'0:43',end:'0:58'},selectionError='',songUrl='',query=null,prepareError=false,prepareUrl=null,sessionStore=new Map()}={}){
  const events=[],rows=[],files=[],preparations=[],navigations=[],els=new Map();
  const el=id=>{if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,files:[],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},reportValidity(){return true;},scrollIntoView(){}});return els.get(id);};
  el('songUrl').value=songUrl;el('email').value='buyer@example.test';el('artist').value='Test Artist';el('notes').value='Full song 2:45, rooftop performance';
  el('photos').files=photo?[{name:'face.jpg',type:'image/jpeg',size:500}]:[];
  el('song').files=song?[{name:'song.mp3',type:'audio/mpeg',size:1000}]:[];
  const client={storage:{from:bucket=>({upload:async(path,file)=>{assert.equal(bucket,'submissions');files.push(path);return {error:storageError};}})},from:table=>({insert:async row=>{assert.equal(table,'submissions');const allowed=['ref','artist_name','contact','photo_paths','song_path','song_url','start_time','end_time','style'];assert.deepEqual(Object.keys(row).sort(),allowed.sort());rows.push(row);return {error:insertError};}})};
  const context=vm.createContext({document:{querySelector:()=>el('materialsForm'),getElementById:el},location:{search:query??'?ref='+reference,assign:url=>navigations.push(url)},sessionStorage:{getItem:key=>sessionStore.get(key)||null,setItem:(key,value)=>sessionStore.set(key,value),removeItem:key=>sessionStore.delete(key)},URL,URLSearchParams,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},window:{supabase:{createClient:()=>client},toonclipzSongPicker:{validate:()=>selectionError,getSelection:()=>selection,destroy(){}},toonclipzActivity:type=>events.push(type)},console:{warn(){}},AbortSignal,fetch:async(url,options)=>{assert.equal(url,'/.netlify/functions/deposit-order');if(!options.method)return {ok:!prepareError,json:async()=>({available:!prepareError})};const body=JSON.parse(options.body);preparations.push(body);return {ok:!prepareError,json:async()=>({ok:!prepareError,ref:body.ref,checkoutUrl:prepareUrl||'https://buy.stripe.com/eVqdRabZ33KTdMjfDJ2wU0b?client_reference_id='+body.ref})};}});
  vm.runInContext(readFileSync(new URL('../order-upload.js',import.meta.url),'utf8'),context);
  vm.runInContext(source,context);
  return {el,events,rows,files,preparations,navigations,sessionStore,submit:()=>el('materialsForm').listeners.submit({preventDefault(){}})};
}
test('materials upload matches the live schema and records full-video request without premature success',async()=>{
  const h=setup();await h.submit();assert.equal(h.rows.length,1);assert.equal(h.files.length,2);
  assert.match(h.rows[0].contact,/Requested duration: up to 180 seconds/);assert.match(h.rows[0].contact,/Creative idea: Full song 2:45/);assert.equal(h.rows[0].mood,undefined);
  assert.equal(h.el('materialsForm').hidden,true);assert.deepEqual(h.events,['details_saved']);
});
test('manually entered checkout reference determines duration at submission time',async()=>{
  const h=setup({reference:''});h.el('orderRef').value='TC-60-manual';await h.submit();assert.match(h.rows[0].contact,/Requested duration: 60 seconds/);
});
test('failed storage or database saves keep the form open and never count a completed upload',async()=>{
  for(const options of [{storageError:{message:'storage unavailable'}},{insertError:{message:'schema unavailable'}}]){
    const h=setup(options);await h.submit();assert.equal(h.el('materialsForm').hidden,false);assert.equal(h.el('materialsSubmit').disabled,false);assert.deepEqual(h.events,['form_error']);assert.match(h.el('uploadStatus').textContent,/could not finish/);
  }
});
test('confirmed preview timestamps survive upload without changing the requested package length',async()=>{
  const h=setup({reference:'TC-D60-example'});await h.submit();
  assert.equal(h.rows[0].start_time,'0:43');assert.equal(h.rows[0].end_time,'0:58');
  assert.match(h.rows[0].contact,/Confirmed preview section: 0:43 to 0:58/);
  assert.match(h.rows[0].contact,/Requested duration: 60 seconds/);
  assert.match(h.el('doneText').textContent,/0:43–0:58/);
});
test('a missing or unconfirmed selection never uploads a song or inserts an order',async()=>{
  for(const options of [{selection:null},{selectionError:'Confirm your preview section.'}]){
    const h=setup(options);await h.submit();assert.equal(h.rows.length,0);assert.equal(h.files.length,0);
    assert.equal(h.el('materialsForm').hidden,false);
  }
});
test('photo-only additions remain possible before the song is ready',async()=>{
  const h=setup({song:false,selection:null});await h.submit();
  assert.equal(h.rows.length,1);assert.equal(h.rows[0].start_time,'');assert.equal(h.rows[0].end_time,'');
  assert.match(h.rows[0].contact,/song pending/);
});
test('additional artists are saved as a custom quote request without marking an add-on paid',async()=>{
  const h=setup({reference:'TC-D60-example'});h.el('artistCount').value='3';await h.submit();
  assert.match(h.rows[0].contact,/Artists requested: 3 \(custom quote required; base package includes 1\)/);
  assert.match(h.rows[0].contact,/Payment: UNVERIFIED/);
  assert.match(h.rows[0].contact,/Requested duration: 60 seconds/);
});



test('link-only materials save the URL and exact timestamp with no file upload',async()=>{
 const h=setup({song:false,photo:false,songUrl:'https://youtu.be/testsong',reference:'TC-D-example'});await h.submit();
 assert.equal(h.rows.length,1);assert.equal(h.files.length,0);assert.equal(h.rows[0].song_url,'https://youtu.be/testsong');assert.equal(h.rows[0].song_path,'');
 assert.equal(h.rows[0].start_time,'0:43');assert.match(h.rows[0].contact,/link provided/);assert.match(h.rows[0].contact,/Payment: UNVERIFIED/);
});

test('links are allowlisted HTTPS text only, never fetched or embedded',async()=>{
 for(const songUrl of ['javascript:alert(1)','http://youtu.be/a','https://evil.test/a','https://youtube.com.evil.test/a','https://user:secret@youtu.be/a','https://youtu.be:8443/a','https://youtu.be/','https://youtu.be/a x']){
  const h=setup({song:false,songUrl});await h.submit();assert.equal(h.rows.length,0);assert.equal(h.files.length,0);assert.equal(h.preparations.length,0);
 }
});

test('screen recordings upload with timestamp and empty or oversized media is rejected',async()=>{
 for(const file of [{name:'phone.mov',type:'video/quicktime',size:2000},{name:'phone.mp4',type:'video/mp4',size:2000},{name:'phone.m4v',type:'',size:2000}]){
  const h=setup({photo:false});h.el('song').files=[file];await h.submit();assert.equal(h.rows.length,1);assert.equal(h.files.length,1);assert.equal(h.rows[0].start_time,'0:43');
 }
 for(const size of [0,50*1024*1024+1]){const h=setup();h.el('song').files[0].size=size;await h.submit();assert.equal(h.rows.length,0);assert.equal(h.files.length,0);}
});

test('materials-first deposits save through the server before opening the associated $5 checkout',async()=>{
 const h=setup({query:'?tier=60&checkout=deposit'});await h.submit();
 assert.equal(h.rows.length,0);assert.equal(h.files.length,2);assert.equal(h.preparations.length,1);
 const ref='TC-D60-00000000-0000-4000-8000-000000000001';
 assert.equal(h.preparations[0].ref,ref);assert.equal(h.preparations[0].email,'buyer@example.test');
 assert.equal(h.navigations.length,1);assert.equal(new URL(h.navigations[0]).searchParams.get('client_reference_id'),ref);
 assert.equal(h.el('continuePayment').hidden,false);assert.equal(h.el('orderRef').readOnly,true);
 assert.deepEqual(h.events,['details_saved','checkout']);await h.submit();assert.equal(h.preparations.length,1);
});

test('materials-first checkout never opens on missing materials, save failure or a mismatched checkout URL',async()=>{
 for(const options of [{song:false,selection:null},{photo:false},{prepareError:true},{prepareUrl:'https://evil.test/pay'}]){
  const h=setup({query:'?tier=30&checkout=deposit',...options});await h.submit();assert.equal(h.navigations.length,0);assert.equal(h.el('materialsForm').hidden,false);
 }
 const link=setup({query:'?tier=180&checkout=deposit',song:false,songUrl:'https://soundcloud.com/artist/song'});await link.submit();assert.equal(link.navigations.length,1);assert.equal(link.preparations[0].song_url,'https://soundcloud.com/artist/song');
 const animal=setup({query:'?tier=30&checkout=deposit',photo:false});animal.el('visualStyle').value='characters';await animal.submit();assert.equal(animal.navigations.length,1);
});


test('the email hint works before checkout and for existing-order additions',()=>{
 const html=readFileSync(new URL('../submit/index.html',import.meta.url),'utf8');
 assert.match(html,/Use the same email for your materials and Stripe checkout/);
 assert.doesNotMatch(html,/Use the same email you used at checkout/);
});
