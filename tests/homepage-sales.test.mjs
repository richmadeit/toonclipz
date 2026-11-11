import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const videos=readFileSync(new URL('../videos/index.html',import.meta.url),'utf8');

test('homepage and videos route offer the same weekly plan with no legacy checkout',()=>{
 assert.equal(root.trim(),videos.trim());
 assert.doesNotMatch(root,/http-equiv=["']refresh|hub\.js|hub\.css/);
 assert.match(root,/\$150 per week/);
 assert.match(root,/five custom 30-second AI videos/);
 assert.match(root,/five working days/);
 assert.match(root,/Two revision requests total across the week/);
 assert.match(root,/The \$5 preview is not credited toward the \$150 weekly fee/);
 assert.match(root,/Your existing order, deposit credit and agreed terms stay unchanged/);
 assert.doesNotMatch(root,/href="https:\/\/buy\.stripe\.com|checkout=deposit/);
 assert.match(root,/New-plan checkout is being updated/);
 assert.match(root,/href="mailto:rich\.madeit3@gmail\.com\?subject=ToonClipz%20Weekly/);
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
