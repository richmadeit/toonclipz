import {cookie,equal,json,sameOrigin,secret} from './traffic/lib/core.mjs';
export default async function handler(req){
  if(req.method!=='POST')return json(405,{error:'Method not allowed'});
  if(!sameOrigin(req))return json(403,{error:'Invalid origin'});
  const key=secret(process.env);if(!key)return json(503,{error:'Dashboard setup: add TOONCLIPZ_DASHBOARD_PASSWORD (at least 16 characters) to Netlify environment variables, then redeploy.'});
  try{
    const raw=await req.text();if(raw.length>1024)return json(413,{error:'Request too large'});
    const data=JSON.parse(raw);
    if(data.logout)return json(200,{ok:true},{'Set-Cookie':cookie(key,Date.now(),true)});
    if(typeof data.password!=='string'||!equal(data.password,key))return json(401,{error:'Incorrect dashboard password.'});
    return json(200,{ok:true},{'Set-Cookie':cookie(key)});
  }catch{return json(400,{error:'Invalid request'});}
}
export const config={rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
