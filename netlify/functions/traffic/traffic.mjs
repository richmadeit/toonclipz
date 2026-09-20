import {getStore} from '@netlify/blobs';
import {cleanEvent,json,record,sameOrigin} from './lib/core.mjs';
export default async function handler(req){
  if(req.method!=='POST')return json(405,{error:'Method not allowed'});
  if(!sameOrigin(req))return json(403,{error:'Invalid origin'});
  // Preview deploys must not contaminate the production site's shared store.
  if(process.env.CONTEXT && process.env.CONTEXT!=='production')return new Response(null,{status:204});
  if(req.headers.get('sec-gpc')==='1'||req.headers.get('dnt')==='1'||/bot|crawler|spider|headless/i.test(req.headers.get('user-agent')||''))return new Response(null,{status:204});
  try{
    const text=await req.text();if(text.length>1024)return json(413,{error:'Request too large'});
    const event=cleanEvent(JSON.parse(text));if(!event)return json(400,{error:'Invalid event'});
    await record(getStore({name:'toonclipz-traffic-v1',consistency:'strong'}),event);
    return new Response(null,{status:204});
  }catch{return json(503,{error:'Tracking temporarily unavailable'});}
}
export const config={rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
