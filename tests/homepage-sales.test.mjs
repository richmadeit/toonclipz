import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const videos=readFileSync(new URL('../videos/index.html',import.meta.url),'utf8');

test('homepage and videos route offer exact-second pricing without legacy checkout',()=>{
 assert.equal(root.trim(),videos.trim());
 assert.doesNotMatch(root,/http-equiv=["']refresh|hub\.js|hub\.css/);
 assert.match(root,/\$1 per second/);
 assert.match(root,/30-second minimum/);
 assert.match(root,/id="videoSeconds"[^>]+min="30"[^>]+step="1"/);
 assert.match(root,/id="includePreview"/);
 assert.match(root,/not credited toward it/);
 assert.match(root,/Your existing order, deposit credit and agreed terms stay unchanged/);
 assert.doesNotMatch(root,/href="https:\/\/buy\.stripe\.com|checkout=deposit|\$150|five working days|Two revision requests total/);
 assert.match(root,/Checkout for this new offer is being updated/);
 assert.match(root,/href="mailto:rich\.madeit3@gmail\.com/);
 assert.match(root,/href="\/submit\/"/);
});

test('homepage assets and navigation resolve without a videos directory prefix',()=>{
 for(const [,url] of root.matchAll(/(?:href|src|poster)="([^"]+)"/g)){
  assert.ok(url.startsWith('/')||url.startsWith('#')||url.startsWith('https://')||url.startsWith('mailto:'),url);
 }
 for(const script of ['portfolio.js','gta-offers.js','activity.js']){
  assert.equal((root.match(new RegExp('<script src="/'+script.replace('.','\\.')+'(?:\\?|" )?','g'))||[]).length,1);
 }
 assert.match(root,/fbq\('init','1066699776252161'\)/);
 assert.match(root,/navigator\.globalPrivacyControl/);
 assert.match(root,/window\.toonclipzAnalyticsConsent/);
 assert.doesNotMatch(root,/location\.(replace|assign)|window\.location\s*=/);
});
