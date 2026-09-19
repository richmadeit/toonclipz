import {AppError,now} from './domain.mjs';
export class SupabaseRepository {
  constructor(env,fetcher=fetch){this.env=env;this.fetch=fetcher;}
  async call(path,{method='GET',body,headers={}}={}) {
    const key=this.env.SUPABASE_SECRET_KEY;
    if(!this.env.SUPABASE_URL||!key)throw new AppError(503,'Order storage is not connected yet. No request was saved.');
    const h={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation',...headers};
    if(!key.startsWith('sb_secret_'))h.Authorization=`Bearer ${key}`;
    let response;
    try {response=await this.fetch(`${this.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${path}`,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});}catch{throw new AppError(503,'The order database is not responding. Try again; do not send payment.');}
    if(!response.ok){if(response.status===409)throw new AppError(409,'This record changed, or an open batch already exists. Refresh and try again.');throw new AppError(503,'The order database could not complete this request. Contact Rich.');}
    if(response.status===204)return null;return response.json();
  }
  async bonusReady(){
    const rows=await this.call('rbi_chips_buyer_content?id=eq.customer-pack&select=id&limit=1');
    return rows.length===1;
  }
  async bonus(){
    const rows=await this.call('rbi_chips_buyer_content?id=eq.customer-pack&select=payload&limit=1');
    const pack=rows[0]?.payload;
    if(!pack||typeof pack!=='object'||!Array.isArray(pack.items)||pack.items.length===0)
      throw new AppError(503,'Your buyer pack is not available yet. Message Rich.');
    return pack;
  }
  async settings(){const r=await this.call('rbi_chips_settings?id=eq.1&select=data');return r[0]?.data||{};}
  async saveSettings(data){await this.call('rbi_chips_settings?on_conflict=id',{method:'POST',body:{id:1,data},headers:{Prefer:'resolution=merge-duplicates,return=representation'}});return data;}
  async activeBatch(){const r=await this.call('rbi_chips_batches?is_open=eq.true&select=*&limit=1');return r[0]||null;}
  async batches(){return this.call('rbi_chips_batches?select=*&order=created_at.desc&limit=100');}
  async batch(id){if(!id)return null;const r=await this.call(`rbi_chips_batches?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return r[0]||null;}
  async saveBatch(id,data,revision){
    if(!id){return (await this.call('rbi_chips_batches',{method:'POST',body:data}))[0];}
    const r=await this.call('rpc/rbi_chips_update_batch',{method:'POST',body:{p_id:id,p_revision:revision,p_patch:data}});
    if(!r.length)throw new AppError(409,'The batch changed in another tab. Refresh before saving.');return r[0];
  }
  async order(id){const r=await this.call(`rbi_chips_orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return r[0]||null;}
  async orderWithKey(id,keyHash){const r=await this.call(`rbi_chips_orders?id=eq.${encodeURIComponent(id)}&access_hash=eq.${keyHash}&select=*&limit=1`);return r[0]||null;}
  async byRequest(key){const r=await this.call(`rbi_chips_orders?request_key=eq.${encodeURIComponent(key)}&select=*&limit=1`);return r[0]||null;}
  async createOrder(row){return (await this.call('rbi_chips_orders',{method:'POST',body:row}))[0];}
  async updateOrder(id,revision,data,extra={}){
    const r=await this.call('rpc/rbi_chips_update_order',{method:'POST',body:{p_id:id,p_revision:revision,p_data:data,p_access_hash:extra.access_hash||null}});
    if(!r.length)throw new AppError(409,'This order just changed. Refresh before trying again.');return r[0];
  }
  async orders(page=0){return this.call(`rbi_chips_orders?select=*&order=created_at.desc&limit=50&offset=${page*50}`);}
  async batchOrders(id){
    const out=[];
    for(let offset=0;offset<100000;offset+=1000){
      const page=await this.call(`rbi_chips_orders?batch_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc&limit=1000&offset=${offset}`);
      out.push(...page);if(page.length<1000)return out;
    }
    throw new AppError(503,'This batch is too large for the manifest tool. Export from the database.');
  }
  async rate(bucket,limit,seconds){return this.call('rpc/rbi_chips_allow_request',{method:'POST',body:{p_bucket:bucket,p_limit:limit,p_seconds:seconds}});}
}
