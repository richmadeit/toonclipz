import crypto from 'node:crypto';
import rules from './rules.cjs';
export {rules};
export class AppError extends Error {constructor(status,message){super(message);this.status=status;}}
export const assert=(ok,message,status=400)=>{if(!ok)throw new AppError(status,message);};
export const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
export const newKey=()=>crypto.randomBytes(32).toString('base64url');
export const newId=()=>`RBI-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
export const uuid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function text(v,max,required=false){assert(typeof v==='string' || v==null,'Please check the text fields.');const s=(v||'').trim();assert(s.length<=max && (!required || s.length>0),`Please check the required fields (maximum ${max} characters).`);assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),'Remove unusual control characters.');return s;}
export function date(v,required=false){const s=text(v,10,required);if(!s)return null;assert(/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s,'Use a valid date.');return s;}
export function amount(v,name){assert(Number.isSafeInteger(v)&&v>=0&&v<=100000000,`Enter a valid ${name} in cents, including 0 when none is due.`);return v;}
export function safeURL(v,{telegram=false}={}){
  const s=text(v,500);if(!s)return '';let u;try{u=new URL(s);}catch{throw new AppError(400,'Enter a complete https:// link.');}
  assert(u.protocol==='https:'&&!u.username&&!u.password,'Only secure HTTPS links are allowed.');
  if(telegram)assert(u.hostname==='t.me'&&u.pathname.length>1,'Use the private t.me Telegram invite link.');
  return u.href;
}
export function validateRequest(body){
  let pricing;try{pricing=rules.price(body.items);}catch(e){throw new AppError(400,e.message);}assert(pricing.eligible,'Pick at least 5 chips. You can mix models.');
  assert(body.experienced===true&&body.preorder===true&&body.contactConsent===true,'Confirm repair experience, preorder terms, and permission to contact you about this request.');
  const type=text(body.buyerType,20,true);assert(['shop','independent'].includes(type),'Choose repair shop or independent repair tech.');
  assert(!pricing.bulk||type==='shop','Orders of 20 or more are for repair shops only.');
  const phone=text(body.phone,35,true);assert(/^[+\d()\s.-]+$/.test(phone)&&phone.replace(/\D/g,'').length>=10&&phone.replace(/\D/g,'').length<=15,'Enter a phone number with 10 to 15 digits.');
  const buyer={name:text(body.name,100,true),phone,type,business:text(body.business,120),page:text(body.page,250),postal:text(body.postal,20,true),notes:text(body.notes,1000)};
  if(type==='shop')assert(buyer.business,'Enter the repair shop name.');
  assert(typeof body.accessKey==='string'&&/^[A-Za-z0-9_-]{43}$/.test(body.accessKey),'The private access key is invalid. Reload the page.');
  assert(typeof body.requestKey==='string'&&/^[a-f0-9-]{36}$/i.test(body.requestKey),'The request identifier is invalid. Reload the page.');
  return {items:pricing.items,quantity:pricing.quantity,subtotalCents:pricing.subtotalCents,buyer,stage:'requested',quote:null,payment:null,shipment:null,refund:null,cancellation:null,events:[],termsVersion:'2026-09-18-v2',consents:{experienced:true,preorder:true,contact:true}};
}
export function publicOrder(row,batch){
  const d=row.data;
  return {id:row.id,stage:rules.effectiveStage(d,batch),baseStage:d.stage,createdAt:row.created_at,updatedAt:row.updated_at,items:d.items,quantity:d.quantity,subtotalCents:d.subtotalCents,quote:d.quote,shipment:d.shipment,paidAt:d.payment?.verifiedAt||null,cancellation:d.cancellation?{requestedAt:d.cancellation.requestedAt,reply:d.cancellation.reply||''}:null,refund:d.refund?{amountCents:d.refund.amountCents,recordedAt:d.refund.recordedAt}:null,bonusAvailable:!!d.payment&&['paid','shipped','delivered'].includes(d.stage),events:d.events.filter(e=>e.public).map(({at,message})=>({at,message})),batch:batch?publicBatch(batch):null};
}
export function publicBatch(b){return {label:b.label,stage:b.stage,closesOn:b.close_on,orderBy:b.order_by,orderedOn:b.ordered_on,expectedStart:b.expected_start,expectedEnd:b.expected_end,nextUpdateOn:b.next_update_on,note:b.note,updatedAt:b.updated_at};}
export function adminOrder(row){const {access_hash,request_key,payload_hash,...r}=row;return r;}
export const event=(message,actor='buyer',visible=true)=>({at:now(),message,actor,public:visible});
export function applyAction(row,body,settings,batch,actor){
  const d=structuredClone(row.data);const action=body.action;let message='';
  const pending=['requested','approved'];const paid=['paid','shipped','delivered'];
  if(action==='approve'){
    assert(pending.includes(d.stage),'Only unpaid requests can be quoted.');assert(!d.cancellation,'Resolve the cancellation request before quoting.');
    assert(batch?.is_open&&batch.close_on>=day(),'This batch is closed. Do not quote new orders in a closed batch.');
    assert(body.compatibilityChecked===true&&body.guidesChecked===true,'Verify compatibility and the matching instructions for every selected chip before approving.');
    assert(body.authorizedDevices===true,'Confirm the buyer works only on devices they own or are authorized to service.');
    const shippingCents=amount(body.shippingCents,'shipping');const taxCents=amount(body.taxCents,'tax');
    const pricing=rules.price(d.items);let unitCents=pricing.unitCents;
    if(pricing.bulk){assert(d.buyer.type==='shop','Bulk orders are for repair shops only.');unitCents=amount(body.unitCents,'bulk unit price');assert(unitCents>0,'Set a bulk price.');}
    const shipBy=date(body.shipBy,true);assert(shipBy>=day()&&shipBy>=batch.order_by,'The estimated ship-by date must be after the supplier order date.');
    const shippingAddress=text(body.shippingAddress,600,true);
    d.shippingAddress=shippingAddress;
    const details=text(body.compatibilityNotes,1800,true);
    d.quote={version:(d.quote?.version||0)+1,unitCents,subtotalCents:unitCents*d.quantity,shippingCents,taxCents,totalCents:unitCents*d.quantity+shippingCents+taxCents,shipBy,expiresOn:batch.close_on,compatibilityNotes:details,returnsPolicy:settings.returns_policy,termsVersion:d.termsVersion,acceptedAt:null,createdAt:now()};
    d.compatibilityChecked=true;d.guidesChecked=true;d.authorizedDevices=true;d.stage='approved';message='Your quote is ready. Review the full price, compatibility notes, and shipping date before paying.';
  }else if(action==='paid'){
    assert(!d.cancellation,'Resolve the cancellation request before accepting payment.');assert(d.stage==='approved'&&d.quote?.acceptedAt,'The buyer must accept the current quote before payment is recorded.');
    assert(d.quote.expiresOn>=day(),'The quote has expired. Re-approve it before accepting payment.');
    assert(['collecting'].includes(batch?.stage)&&batch?.is_open,'Supplier order already placed or batch closed. Do not add uncommitted chips.');
    const paidCents=amount(body.amountCents,'payment');assert(paidCents===d.quote.totalCents,'Payment must match the full approved total.');
    assert(['Cash App','Zelle','Other'].includes(body.method),'Choose the payment method.');
    assert(body.paymentVerified===true,'Verify the actual payment in your payment app, not just a screenshot.');
    d.payment={amountCents:paidCents,method:body.method,reference:text(body.reference,150,true),verifiedAt:now()};d.stage='paid';message='Rich verified your payment. Your pieces are committed. Your buyer pack is now available.';
  }else if(action==='ship'){
    assert(d.stage==='paid'&&batch?.stage==='arrived','Mark the batch as arrived at Rich before shipping a paid order.');
    assert(!d.cancellation,'Resolve the cancellation request before shipping.');
    const number=text(body.trackingNumber,60,true),carrier=text(body.carrier,20,true);
    assert(rules.trackingURL(carrier,number),'Choose a supported carrier and enter a valid tracking number.');
    assert(body.handedToCarrier===true,'Confirm the package has been handed to the carrier. A label alone is not a shipment.');
    d.shipment={carrier,number,url:rules.trackingURL(carrier,number),shippedAt:now()};d.stage='shipped';message=`Your package was handed to ${carrier}. Your tracking link is ready.`;
  }else if(action==='tracking'){
    assert(['shipped','delivered'].includes(d.stage),'Tracking can be corrected after shipment.');
    const number=text(body.trackingNumber,60,true),carrier=text(body.carrier,20,true);
    assert(rules.trackingURL(carrier,number),'Check the carrier and tracking number.');
    d.shipment={...d.shipment,carrier,number,url:rules.trackingURL(carrier,number)};message='Rich corrected the carrier tracking details.';
  }else if(action==='deliver'){
    assert(d.stage==='shipped','Only a shipped order can be marked delivered.');assert(body.deliveryVerified===true,'Confirm delivery with the carrier before marking delivered.');
    d.shipment.deliveredAt=now();d.stage='delivered';message='Delivery confirmed by Rich using the carrier tracking record.';
  }else if(action==='cancel'||action==='decline'){
    assert(pending.includes(d.stage),'A paid order cannot be cancelled without recording the refund.');d.stage=action==='cancel'?'cancelled':'declined';message=text(body.message,800,true);
  }else if(action==='refund'){
    assert(paid.includes(d.stage)&&d.payment,'Only paid orders can be refunded.');assert(body.refundVerified===true,'Issue and verify the refund in your payment app first.');
    const refundCents=amount(body.amountCents,'refund');assert(refundCents===d.payment.amountCents,'This workflow records full refunds only. Do not label a partial refund as a full refund.');
    d.refund={amountCents:refundCents,reference:text(body.reference,150,true),recordedAt:now()};d.stage='refunded';message='Rich recorded your full refund. Contact Rich with any payment questions.';
  }else if(action==='note'){
    message=text(body.message,1000,true);
  }else if(action==='resolve_cancel'){
    assert(d.cancellation,'No cancellation request is open.');assert(body.buyerAgreed===true,'Confirm the buyer agreed to continue before clearing the request.');message=text(body.message,1000,true);d.cancellation=null;
  }else throw new AppError(400,'Unknown order action.');
  d.events.push(event(message,actor));return d;
}
export function validateBatch(b){
  const stage=text(b.stage,20,true);assert(['collecting','ordered','inbound','arrived'].includes(stage),'Choose a batch stage.');
  const close_on=date(b.close_on,true),order_by=date(b.order_by,true),ordered_on=date(b.ordered_on);
  assert(order_by>=close_on,'Supplier order date cannot be before the request cutoff.');
  if(stage!=='collecting')assert(ordered_on,'Enter the actual supplier order date.');
  if(ordered_on)assert(ordered_on<=day(),'The actual supplier order date cannot be in the future.');
  const expected_start=date(b.expected_start),expected_end=date(b.expected_end);
  assert(!expected_start||!expected_end||expected_end>=expected_start,'Check the arrival date range.');
  assert(!b.is_open||stage==='collecting','Only a collecting batch can accept new requests.');
  return {label:text(b.label,100,true),stage,is_open:b.is_open===true,close_on,order_by,ordered_on,expected_start,expected_end,next_update_on:date(b.next_update_on,true),note:text(b.note,1200)};
}
export function validateSettings(b){
  const d={support_url:safeURL(b.support_url),support_label:text(b.support_label,70),telegram_url:safeURL(b.telegram_url,{telegram:true}),returns_policy:text(b.returns_policy,5000),launch_approved:b.launch_approved===true};
  if(d.launch_approved)assert(d.support_url&&d.telegram_url&&d.returns_policy.length>=40,'Add your contact link, Telegram invite, and return/defect policy before opening preorders.');
  return d;
}
