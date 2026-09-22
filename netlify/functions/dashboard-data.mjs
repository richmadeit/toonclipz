import {getStore} from '@netlify/blobs';
import {authorized,json,readPurchases,readTraffic,secret} from './traffic/lib/core.mjs';
const cache=new Map();
export default async function handler(req){
  if(req.method!=='GET')return json(405,{error:'Method not allowed'});
  const key=secret(process.env);if(!key)return json(503,{error:'Dashboard setup is not complete. Add TOONCLIPZ_DASHBOARD_PASSWORD in Netlify and redeploy.'});
  if(!authorized(req,key))return json(401,{error:'Please sign in.'});
  const brand=new URL(req.url).searchParams.get('brand')==='richmadeit'?'richmadeit':'toonclipz';
  const range=new URL(req.url).searchParams.get('range')==='7d'?'7d':'24h',now=Date.now(),since=now-(range==='7d'?7:1)*86400000;
  const cached=cache.get(brand+':'+range);if(cached&&now-cached.at<20000)return json(200,cached.data);
  try{
    const [traffic,purchases]=await Promise.all([readTraffic(getStore({name:brand+'-traffic-v1',consistency:'strong'}),since,now),readPurchases(process.env,since,fetch,brand).catch(()=>({available:false,reason:'Stripe could not be reached. Purchases are unavailable, not zero.'}))]);
    const data={brand,traffic,purchases,updatedAt:now,since};cache.set(brand+':'+range,{at:now,data});return json(200,data);
  }catch{return json(503,{error:'Activity storage is temporarily unavailable. Try refreshing shortly.'});}
}
export const config={rateLimit:{windowLimit:30,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
