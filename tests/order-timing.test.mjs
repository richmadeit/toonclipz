import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('legacy intake and payment preserve their existing timing terms',()=>{
 for(const file of ['submit/index.html','order.js','payment-confirmation.html','payment-confirmation.js']){
  const s=read(file);
  assert.match(s,/same.day/i,file);
  assert.match(s,/24–72 hours/,file);
  assert.match(s,/remaining (?:payment|balance)/,file);
  assert.match(s,/all required materials/,file);
  assert.doesNotMatch(s,/preview (?:in|is due in|is ready in|turnaround is) 24–72/i,file);
  assert.doesNotMatch(s,/cutoff|business hours|excluding Sundays/i,file);
 }
 assert.equal(read('index.html'),read('videos/index.html'));
});
