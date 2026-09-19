/* One set of catalog and pricing rules, shared by the browser and the server. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RBIRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const products = Object.freeze([
    {id:'p14pro', label:'iPhone 14 Pro / 14 Pro Max', short:'14 Pro / 14 Pro Max', series:'14', image:'14pro.webp', excludes:'Not for iPhone 14 or 14 Plus.', guide:'Rich provided a direct link matching the supplier QR labeled iPhone 14 Pro / 14 Pro Max. Tutorial contents and playback still need review.', tutorialUrl:'https://wx.hlcode.top/?id=NawxH0I', tutorialLabel:'14 Pro / 14 Pro Max tutorial', tutorialModel:'iPhone 14 Pro / 14 Pro Max', tutorialVerified:false},
    {id:'p15', label:'iPhone 15 / 15 Plus', short:'15 / 15 Plus', series:'15', image:'15.webp', excludes:'Not for iPhone 15 Pro or Pro Max.', guide:'Supplier QR label received. Tutorial content still needs verification.'},
    {id:'p15pro', label:'iPhone 15 Pro / 15 Pro Max', short:'15 Pro / 15 Pro Max', series:'15', image:'15pro.webp', excludes:'Not for iPhone 15 or 15 Plus.', guide:'A clearer tutorial QR or direct supplier link is needed.'},
    {id:'p16', label:'iPhone 16 / 16 Plus', short:'16 / 16 Plus', series:'16', image:'16.webp', excludes:'Select this chip type for the two regular models listed.', guide:'Supplier QR label received. Tutorial content still needs verification.'},
    {id:'p16pro', label:'iPhone 16 Pro / 16 Pro Max', short:'16 Pro / 16 Pro Max', series:'16', image:'16pro.webp', excludes:'Select this chip type for the two Pro models listed.', guide:'Separate tutorial QR or direct supplier link is still needed.'},
    {id:'p17pro', label:'iPhone 17 Pro / 17 Pro Max', short:'17 Pro / 17 Pro Max', series:'17', image:'17pro.webp', excludes:'Only the two Pro models shown are listed for this chip.', guide:'Rich provided a direct link for the iPhone 17 Pro Max. Tutorial contents and playback still need review.', tutorialUrl:'https://wx.hlcode.top/?id=Na6YLBd', tutorialLabel:'17 Pro Max tutorial', tutorialModel:'iPhone 17 Pro Max', tutorialVerified:false}
  ]);
  const byId = Object.fromEntries(products.map(p => [p.id,p]));
  function cart(items) {
    if (!Array.isArray(items) || items.length > products.length) throw new Error('Choose quantities from the six listed chip types.');
    const seen = new Set();
    const result = [];
    for (const item of items) {
      if (!item || !Object.hasOwn(byId,item.id) || seen.has(item.id)) throw new Error('One of the chip selections is not valid.');
      seen.add(item.id);
      if (!Number.isInteger(item.qty) || item.qty < 0 || item.qty > 99) throw new Error('Use whole numbers from 0 to 99 for each chip type.');
      if (item.qty) result.push({id:item.id,qty:item.qty});
    }
    return result.sort((a,b) => products.findIndex(p=>p.id===a.id)-products.findIndex(p=>p.id===b.id));
  }
  function price(items) {
    const clean = cart(items);
    const quantity = clean.reduce((n,i)=>n+i.qty,0);
    const bulk = quantity >= 20;
    const unitCents = bulk ? null : quantity >= 10 ? 1300 : 1500;
    return {items:clean,quantity,bulk,unitCents,subtotalCents:bulk?null:quantity*unitCents,eligible:quantity>=5};
  }
  function money(cents) {return cents == null ? 'Quote needed' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:cents%100?2:0}).format(cents/100);}
  function trackingURL(carrier,number) {
    if (!number || !/^[A-Za-z0-9 -]{5,60}$/.test(number)) return null;
    const n=encodeURIComponent(number.replace(/\s/g,''));
    const urls={USPS:'https://tools.usps.com/go/TrackConfirmAction?tLabels=',UPS:'https://www.ups.com/track?tracknum=',FedEx:'https://www.fedex.com/fedextrack/?trknbr=',DHL:'https://www.dhl.com/us-en/home/tracking.html?tracking-id='};
    return urls[carrier] ? urls[carrier]+n : null;
  }
  const stageLabels={requested:'Request received',approved:'Approved — review your quote',paid:'Payment verified',ordered:'Ordered from supplier',inbound:'On the way to Rich',arrived:'At Rich — preparing your package',shipped:'Shipped to you',delivered:'Delivered',cancelled:'Cancelled',refunded:'Refund recorded',declined:'Request not approved'};
  function effectiveStage(order,batch) {
    if (order.stage !== 'paid') return order.stage;
    return batch && ['ordered','inbound','arrived'].includes(batch.stage) ? batch.stage : 'paid';
  }
  return {products,byId,cart,price,money,trackingURL,effectiveStage,stageLabels};
});
