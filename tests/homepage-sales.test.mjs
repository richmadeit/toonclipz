import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const videos=readFileSync(new URL('../videos/index.html',import.meta.url),'utf8');

test('homepage serves the same current video-package page without a redirect or hub',()=>{
 assert.equal(root.trim(),videos.trim());
 assert.doesNotMatch(root,/http-equiv=["']refresh|hub\.js|hub\.css|What are we<br><em>making today/i);
 for(const tier of ['30','60','180'])assert.match(root,new RegExp('href="/submit/\\?tier='+tier+'&amp;checkout=deposit"'));
 assert.equal((root.match(/class="button deposit-start"/g)||[]).length,3);
 assert.equal((root.match(/class="button checkout full-payment"/g)||[]).length,3);
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
