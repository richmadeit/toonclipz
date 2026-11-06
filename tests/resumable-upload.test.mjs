import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../order-upload.js',import.meta.url),'utf8');
function setup({failFirst=false}={}){
 const states=[],messages=[];let id=0;
 class Upload{constructor(body,options){this.options=options;this.starts=0;states.push(this);}start(){this.starts++;if(failFirst&&this.starts===1)this.options.onError(new Error('connection lost'));else{this.options.onProgress(100,100);this.options.onSuccess();}}}
 const window={tus:{Upload}};vm.runInNewContext(source,{window,crypto:{randomUUID:()=>String(++id)}});
 return {states,messages,transfer:window.toonclipzCreateUploader({client:{},apiKey:'public-anon-key',onStatus:message=>messages.push(message)})};
}
const photo={name:'face.png',type:'image/png',size:1234,lastModified:1};
test('retry reuses finished files, while different order references get separate transfers',async()=>{
 const h=setup();const path=await h.transfer(photo,'photo','TC-D-TEST');assert.equal(await h.transfer(photo,'photo','TC-D-TEST'),path);assert.equal(h.states.length,1);assert.equal(h.states[0].starts,1);await h.transfer(photo,'photo','TC-D-OTHER');assert.equal(h.states.length,2);
});
test('retry resumes the same transfer and path after an interrupted upload',async()=>{
 const h=setup({failFirst:true});await assert.rejects(h.transfer(photo,'photo','TC-D-TEST'),/connection lost/);const path=await h.transfer(photo,'photo','TC-D-TEST');assert.equal(h.states.length,1);assert.equal(h.states[0].starts,2);assert.equal(path,h.states[0].options.metadata.objectName);await h.transfer(photo,'photo','TC-D-TEST');assert.equal(h.states[0].starts,2);
});
test('direct storage uses progress, longer timeout and no file overwrite',async()=>{
 const h=setup();await h.transfer(photo,'photo','TC-D-TEST');const o=h.states[0].options;assert.match(o.endpoint,/\.storage\.supabase\.co\/storage\/v1\/upload\/resumable$/);assert.equal(o.chunkSize,6*1024*1024);assert.equal(o.timeout,600000);assert.equal(o.headers['x-upsert'],'false');assert.equal(o.uploadDataDuringCreation,false);assert.match(h.messages.join(' '),/100%/);assert.equal(o.onShouldRetry({originalResponse:{getStatus:()=>403}}),false);assert.equal(o.onShouldRetry({originalResponse:{getStatus:()=>503}}),true);
});



test('phone recordings with omitted browser MIME keep a supported storage content type',async()=>{
 for(const [name,contentType] of [['phone.m4v','video/mp4'],['phone.mov','video/quicktime'],['song.m4a','audio/mp4']]){
  const h=setup();await h.transfer({name,type:'',size:2048,lastModified:1},'song','TC-D30-TEST');assert.equal(h.states[0].options.metadata.contentType,contentType);
 }
});
