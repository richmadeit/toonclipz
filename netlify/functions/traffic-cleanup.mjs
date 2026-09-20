import {getStore} from '@netlify/blobs';
export default async function handler(){
  const store=getStore({name:'toonclipz-traffic-v1',consistency:'strong'});
  const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  for await(const page of store.list({prefix:'sessions/',paginate:true})){
    const old=page.blobs.filter(b=>b.key.split('/')[1]<cutoff);
    for(let i=0;i<old.length;i+=25)await Promise.all(old.slice(i,i+25).map(b=>store.delete(b.key)));
  }
}
export const config={schedule:'0 5 * * *'};
