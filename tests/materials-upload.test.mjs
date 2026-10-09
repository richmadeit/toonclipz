import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../order.js',import.meta.url),'utf8');
function setup({insertError=null,storageError=null,reference='TC-180-example',photo=true}={}){
  const events=[],rows=[],files=[],els=new Map();
  const el=id=>{if(!els.has(id))els.set(id,{id,value:'',textContent:'',hidden:false,files:[],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},reportValidity(){return true;},scrollIntoView(){}});return els.get(id);};
  el('email').value='buyer@example.test';el('artist').value='Test Artist';el('notes').value='Full song 2:45, rooftop performance';
  el('photos').files=photo?[{name:'face.jpg',type:'image/jpeg',size:500}]:[];
  el('song').files=[{name:'song.mp3',type:'audio/mpeg',size:1000}];
  const client={storage:{from:bucket=>({upload:async(path,file)=>{assert.equal(bucket,'submissions');files.push(path);return {error:storageError};}})},from:table=>({insert:async row=>{assert.equal(table,'submissions');const allowed=['ref','artist_name','contact','photo_paths','song_path','song_url','start_time','end_time','style'];assert.deepEqual(Object.keys(row).sort(),allowed.sort());rows.push(row);return {error:insertError};}})};
  const context=vm.createContext({document:{querySelector:()=>el('materialsForm'),getElementById:el},location:{search:'?ref='+reference},URLSearchParams,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},window:{supabase:{createClient:()=>client},toonclipzActivity:type=>events.push(type)},console:{warn(){}},AbortSignal,fetch});
  vm.runInContext(source,context);
  return {el,events,rows,files,submit:()=>el('materialsForm').listeners.submit({preventDefault(){}})};
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
