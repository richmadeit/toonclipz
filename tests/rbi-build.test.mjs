import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build,WEB_ENTRIES} from '../scripts/build-site.mjs';
import rules from '../netlify/functions/rbi-chips/lib/rules.cjs';

test('preserve every existing ToonClipz web entry in the publish list',()=>{
  for(const entry of ['index.html','admin.html','queue.html','toon.css','toon.js','assets','obs-assets']) assert.ok(WEB_ENTRIES.includes(entry));
});
test('build copies web fixtures without copying server, SQL or private content',async()=>{
  const root=await mkdtemp(join(tmpdir(),'rbi-build-'));
  try{
    for(const entry of WEB_ENTRIES){
      if(entry.includes('.'))await writeFile(join(root,entry),'unchanged-'+entry);
      else{await mkdir(join(root,entry));await writeFile(join(root,entry,'asset.txt'),'unchanged-'+entry);}
    }
    for(const entry of ['netlify','private-content','docs','tests']){await mkdir(join(root,entry));await writeFile(join(root,entry,'never-public.txt'),'private');}
    await writeFile(join(root,'.env'),'private');await writeFile(join(root,'supabase-setup.sql'),'private');
    const out=await build(root);
    assert.deepEqual((await readdir(out)).sort(),[...WEB_ENTRIES].sort());
    for(const entry of WEB_ENTRIES){const name=entry.includes('.')?entry:entry+'/asset.txt';assert.equal(await readFile(join(out,name),'utf8'),await readFile(join(root,name),'utf8'));}
  }finally{await rm(root,{recursive:true,force:true});}
});
test('five-chip minimum, tiers, and bulk quote boundaries remain exact',()=>{
  for(const [qty,cents] of [[0,0],[4,6000],[5,7500],[9,13500],[10,13000],[19,24700],[20,null],[40,null]]){
    const p=rules.price([{id:'p14pro',qty}]);assert.equal(p.subtotalCents,cents);assert.equal(p.eligible,qty>=5);
  }
  assert.equal(rules.price([{id:'p14pro',qty:2},{id:'p17pro',qty:3}]).subtotalCents,7500);
});
test('tutorials stay attached to their exact source model families',()=>{
  assert.equal(rules.byId.p14pro.tutorialUrl,'https://wx.hlcode.top/?id=NawxH0I');
  assert.equal(rules.byId.p17pro.tutorialUrl,'https://wx.hlcode.top/?id=Na6YLBd');
  assert.equal(rules.byId.p17pro.tutorialModel,'iPhone 17 Pro Max');
  for(const p of rules.products) assert.ok(!p.tutorialVerified);
});
test('server and browser model rules are identical and all real photos exist',async()=>{
  const a=await readFile(new URL('../rich-buys-iphone/js/rules.js',import.meta.url),'utf8');
  const b=await readFile(new URL('../netlify/functions/rbi-chips/lib/rules.cjs',import.meta.url),'utf8');assert.equal(a,b);
  for(const p of rules.products) assert.ok((await readFile(new URL('../rich-buys-iphone/assets/'+p.image,import.meta.url))).length>100);
});
test('no trailing-slash-only redirect is introduced',async()=>{
  const text=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');
  assert.ok(!text.includes('from = "/rich-buys-iphone"'));
  assert.ok(text.includes('publish = "dist"'));
});
