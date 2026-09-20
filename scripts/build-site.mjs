import {cp,mkdir,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Add future public ToonClipz assets here. Never publish server code, SQL,
// private buyer content, previews, credentials, or customer records.
export const WEB_ENTRIES=Object.freeze([
  'status.html','status.css','status.js','activity.js','index.html','admin.html','queue.html','toon.css','toon.js','payment-confirmation.html','payment-confirmation.js',
  'assets','obs-assets','rich-buys-iphone'
]);
export async function build(root=fileURLToPath(new URL('../',import.meta.url))){
  const out=join(root,'dist');
  for(const name of WEB_ENTRIES) await stat(join(root,name));
  await rm(out,{recursive:true,force:true});
  await mkdir(out,{recursive:true});
  for(const name of WEB_ENTRIES) await cp(join(root,name),join(out,name),{recursive:true});
  console.log('Built ToonClipz + /rich-buys-iphone/. Live order setup is separate.');
  return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await build();
