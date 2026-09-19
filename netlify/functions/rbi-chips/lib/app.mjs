import {rules,AppError,assert,hash,newId,newKey,now,day,validateRequest,publicOrder,publicBatch,adminOrder,event,applyAction,validateBatch,validateSettings,text} from './domain.mjs';
import {rateBucket} from './auth.mjs';
const requiredEnv=['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY','ADMIN_USER_IDS','SITE_URL','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY'];
const response=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
async function readJSON(req){
  assert(req.headers.get('content-type')?.split(';')[0]==='application/json','Send JSON data.',415);
  const reader=req.body?.getReader();assert(reader,'Request body is required.');let count=0,chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>24000){await reader.cancel();throw new AppError(413,'The request is too large.');}chunks.push(Buffer.from(value));}
  try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert(body&&typeof body==='object'&&!Array.isArray(body),'Invalid request.');return body;}catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'The request could not be read. Reload and try again.');}
}
function originCheck(req,env){
  const allowed=new URL(env.SITE_URL||req.url).origin;
  assert(new URL(req.url).origin===allowed,'Use the main website address for this action.',403);
  if(req.method!=='GET')assert(req.headers.get('origin')===allowed,'Open this action from the main website.',403);
  const site=req.headers.get('sec-fetch-site');assert(!site||['same-origin','none'].includes(site),'Cross-site requests are not allowed.',403);
}
export function launchMissing(env,s,b){
  const missing=requiredEnv.filter(k=>!env[k]).map(k=>'RBI_'+k);
  if(!s.launch_approved)missing.push('Approve the launch checklist');
  if(!s.support_url)missing.push('Public contact link');if(!s.telegram_url)missing.push('Private Telegram invite');
  if(!s.returns_policy||s.returns_policy.length<40)missing.push('Written return/defect policy');
  if(!b||!b.is_open||b.stage!=='collecting'||b.close_on<day()||b.order_by<day())missing.push('Open batch with current cutoff and supplier-order dates');
  if(env.SITE_URL&&!env.SITE_URL.startsWith('https://')&&!env.SITE_URL.startsWith('http://localhost'))missing.push('HTTPS site URL');
  return missing;
}
function manifest(rows){const paid=rows.filter(r=>r.data.payment&&['paid','shipped','delivered'].includes(r.data.stage));return {savedAt:now(),orderCount:paid.length,quantity:paid.reduce((n,r)=>n+r.data.quantity,0),items:rules.products.map(p=>({id:p.id,label:p.label,qty:paid.reduce((n,r)=>n+(r.data.items.find(i=>i.id===p.id)?.qty||0),0)}))};}
export function createHandler({repo,auth,env,fetcher=fetch,loadBonus=()=>repo.bonus()}){
  async function checkLaunch(settings,batch){
    const missing=launchMissing(env,settings,batch);
    let ready=false;try{ready=await repo.bonusReady();}catch{}
    if(!ready)missing.push('Load the private buyer pack in the database');
    return missing;
  }
  async function limited(context,route,max,seconds){const ip=context?.ip;assert(ip,'We could not validate this request. Try again.',429);assert(await repo.rate(rateBucket(env,ip,route),max,seconds),'Too many tries. Wait a few minutes and try again.',429);}
  async function bot(token,context,req){
    assert(env.TURNSTILE_SECRET_KEY,'Preorders are not open yet.',503);assert(typeof token==='string'&&token.length>0&&token.length<2050,'Complete the security check before sending.');
    let r;try{r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:context.ip}),signal:AbortSignal.timeout(10000)});}catch{throw new AppError(503,'The security check is unavailable. Try again.');}
    const check=await r.json();assert(check.success===true&&check.hostname===new URL(env.SITE_URL||req.url).hostname&&check.action==='preorder','Security check expired or failed. Complete it again.');
  }
  async function lookup(b){assert(typeof b.id==='string'&&/^RBI-[A-F0-9]{12}$/.test(b.id)&&typeof b.key==='string'&&/^[A-Za-z0-9_-]{43}$/.test(b.key),'Order not found. Check the order number and private access key.',404);const row=await repo.orderWithKey(b.id,hash(b.key));assert(row,'Order not found. Check the order number and private access key.',404);return row;}
  async function createOrder(body,context,req,admin=false){
    const data=validateRequest(body);const [settings,batch]=await Promise.all([repo.settings(),repo.activeBatch()]);
    assert(!(await checkLaunch(settings,batch)).length,'Preorders are not open yet. Nothing was sent or charged.',503);
    const payloadHash=hash(JSON.stringify(data)); // Events/timestamps added only after the stable fingerprint.
    let existing=await repo.byRequest(body.requestKey);
    if(existing){assert(existing.access_hash===hash(body.accessKey)&&existing.payload_hash===payloadHash,'This request identifier was already used. Reload to create a new request.',409);return {id:existing.id,duplicate:true};}
    if(!admin){assert(!body.website,'The request could not be accepted.');await bot(body.turnstileToken,context,req);}
    data.events.push(event('Request received. No payment has been taken and no chips are reserved.'));data.consents.acceptedAt=now();
    let row;
    try{row=await repo.createOrder({id:newId(),request_key:body.requestKey,access_hash:hash(body.accessKey),payload_hash:payloadHash,batch_id:batch.id,data});}
    catch(e){if(e.status!==409)throw e;existing=await repo.byRequest(body.requestKey);assert(existing&&existing.access_hash===hash(body.accessKey)&&existing.payload_hash===payloadHash,'The request could not be saved. Refresh and retry.',409);row=existing;}
    return {id:row.id,duplicate:false};
  }
  return async function handler(req,context={}){
    try{
      const url=new URL(req.url);
      // Namespaced default function endpoint. No global /api/* route is claimed.
      const action=url.searchParams.get('route')||'';
      assert(/^[a-z][a-z0-9/-]{0,79}$/.test(action)&&!action.includes('//'),'This action was not found.',404);
      const route='/api/'+action;
      originCheck(req,env);
      if(route==='/api/config'&&req.method==='GET'){
        try{const [s,b]=await Promise.all([repo.settings(),repo.activeBatch()]);return response({ready:!(await checkLaunch(s,b)).length,supportURL:s.support_url||'',supportLabel:s.support_label||'Message Rich',returnsPolicy:s.returns_policy||'',turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',batch:b?publicBatch(b):null});}
        catch{return response({ready:false,supportURL:'',supportLabel:'Message Rich',returnsPolicy:'',turnstileSiteKey:'',batch:null});}
      }
      if(route==='/api/login'&&req.method==='POST'){
        await limited(context,'login',5,600);const b=await readJSON(req);const r=await auth.login(b.email,b.password);return response({user:r.user},200,{'Set-Cookie':r.cookie});
      }
      if(route==='/api/logout'&&req.method==='POST'){return response({ok:true},200,{'Set-Cookie':await auth.logout(req)});}
      if(route==='/api/orders'&&req.method==='POST'){await limited(context,'create',8,600);return response(await createOrder(await readJSON(req),context,req),201);}
      if(['/api/lookup','/api/bonus','/api/buyer-action'].includes(route)&&req.method==='POST'){
        await limited(context,'lookup',60,300);const b=await readJSON(req);let row=await lookup(b);let batch=await repo.batch(row.batch_id);
        if(route==='/api/bonus'){const o=publicOrder(row,batch);assert(o.bonusAvailable,'The buyer pack opens after Rich verifies full payment.',403);const s=await repo.settings();return response({pack:await loadBonus(),telegramURL:s.telegram_url||'',supportURL:s.support_url||''});}
        if(route==='/api/buyer-action'){
          const d=structuredClone(row.data);
          if(b.action==='accept_quote'){
            assert(d.stage==='approved'&&d.quote&&d.quote.version===b.quoteVersion,'The quote changed. Reload and review it again.',409);
            assert(d.quote.expiresOn>=day(),'This quote expired. Ask Rich to review it again.');
            assert(b.confirm===true,'Confirm you read the price, date, compatibility notes, and return policy.');
            if(!d.quote.acceptedAt){d.quote.acceptedAt=now();d.events.push(event('You accepted the quote. Message Rich for private payment instructions.'));row=await repo.updateOrder(row.id,row.revision,d);}
          }else if(b.action==='cancel'){
            assert(!['cancelled','refunded','declined'].includes(d.stage),'This order is already closed.');
            if(!d.cancellation){d.cancellation={requestedAt:now(),reason:text(b.reason,600,true)};d.events.push(event('Cancellation request received. Contact Rich to confirm next steps and any refund due.'));row=await repo.updateOrder(row.id,row.revision,d);}
          }else throw new AppError(400,'Unknown action.');
        }
        return response({order:publicOrder(row,batch)});
      }
      if(route.startsWith('/api/admin/')){
        const user=await auth.verify(req);
        if(route==='/api/admin/overview'&&req.method==='GET'){
          const page=Number(url.searchParams.get('page')||0);assert(Number.isSafeInteger(page)&&page>=0&&page<=10000,'Invalid page.');
          const [s,batches,rows]=await Promise.all([repo.settings(),repo.batches(),repo.orders(page)]);const active=batches.find(b=>b.is_open)||null;
          return response({user,settings:s,batches,orders:rows.map(adminOrder),page,hasMore:rows.length===50,missing:await checkLaunch(s,active)});
        }
        if(route==='/api/admin/orders'&&req.method==='POST')return response(await createOrder(await readJSON(req),context,req,true),201);
        if(route==='/api/admin/order'&&req.method==='GET'){
          const id=url.searchParams.get('id');assert(id&&/^RBI-[A-F0-9]{12}$/.test(id),'Enter a complete order number.');const row=await repo.order(id);assert(row,'Order not found.',404);return response({order:adminOrder(row)});
        }
        if(route==='/api/admin/batch-summary'&&req.method==='GET'){const id=url.searchParams.get('id');assert(id&&/^[a-f0-9-]{36}$/i.test(id),'Choose a batch.');const batch=await repo.batch(id);assert(batch,'Batch not found.',404);return response({current:manifest(await repo.batchOrders(id)),ordered:batch.ordered_manifest||null});}
        if(route==='/api/admin/settings'&&req.method==='POST'){
          const b=await readJSON(req),s=validateSettings(b);await repo.saveSettings(s);return response({settings:s});
        }
        if(route==='/api/admin/batch'&&req.method==='POST'){
          const b=await readJSON(req),data=validateBatch(b);if(!b.id)assert(data.stage==='collecting','A new batch must start at collecting. Add it first, then confirm your supplier order.');if(b.id){assert(/^[a-f0-9-]{36}$/i.test(b.id),'Invalid batch.');assert(Number.isInteger(b.revision)&&b.revision>=0,'Reload the batch.');const old=await repo.batch(b.id);assert(old,'Batch not found.',404);const stages=['collecting','ordered','inbound','arrived'];assert(stages.indexOf(data.stage)>=stages.indexOf(old.stage),'A batch cannot move backward. Contact support before correcting a completed stage.');if(old.stage==='collecting'&&data.stage!=='collecting'){assert(b.supplierOrderConfirmed===true,'Confirm the supplier order has actually been placed.');data.ordered_manifest=manifest(await repo.batchOrders(b.id));}else data.ordered_manifest=old.ordered_manifest||null;}
          return response({batch:await repo.saveBatch(b.id||null,data,b.revision)});
        }
        if(route==='/api/admin/order-action'&&req.method==='POST'){
          const b=await readJSON(req);assert(/^RBI-[A-F0-9]{12}$/.test(b.id||''),'Invalid order.');const row=await repo.order(b.id);assert(row,'Order not found.',404);assert(b.revision===row.revision,'Order changed. Refresh before saving.',409);
          if(b.action==='renew_access'){
            const key=newKey(),d=structuredClone(row.data);d.events.push(event('Private access link reset by Rich.',user.id,false));const updated=await repo.updateOrder(row.id,row.revision,d,{access_hash:hash(key)});return response({order:adminOrder(updated),key});
          }
          const [s,batch]=await Promise.all([repo.settings(),repo.batch(row.batch_id)]);const data=applyAction(row,b,s,batch,user.id);const updated=await repo.updateOrder(row.id,row.revision,data);return response({order:adminOrder(updated)});
        }
      }
      return response({error:'This page or action was not found.'},404);
    }catch(e){return response({error:e instanceof AppError?e.message:'Something went wrong. Nothing further was confirmed. Refresh and check your order.'},e instanceof AppError?e.status:500);}
  };
}
