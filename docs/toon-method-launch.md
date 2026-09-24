# Toon Method launch audit — 24 September 2026

## Offer and routes

- `/` remains the separate $60 custom 30-second video service.
- `/toon-method/`: one free, reviewed watermarked still requested by Instagram DM; optional $49 one-time lesson package.
- The $49 package includes the WAN 3.0 Prime case study, visual tutorial, editable prompts, workbook and a buyer Telegram group at no extra charge.
- `/toon-method/access/`: payment check, approved-Google-account workbook login, and private Telegram invitation after a verified eligible payment.
- Workbook approval remains personal. Do not advertise instant or automatic workbook access.
- Topview generation credits are separate. A 15-second clip duration is not a promise of a 15-second production time. 10–20 daily clips is a production target, not a measured guarantee.

## Verified in the code audit

- DDG and MDOTTY B comparison controls use independent native sliders plus original/result buttons.
- The main offer no longer repeats the same video twice. The one example video loads on request; comparison images load lazily with reserved dimensions.
- The package price, included Telegram group and post-payment approval steps are visible before purchase.
- A dedicated method verifier checks the exact configured Stripe Payment Link ID, live mode, USD $49 subtotal, completed and paid session, succeeded payment and charge, no refunds and no dispute.
- The $60 custom-video payment cannot unlock this package. Query flags such as `paid=true` cannot unlock it.
- The Telegram invite is a server environment value. It is not bundled into public page code or the offer configuration response. Verification responses are not cached.
- Checkout session references are removed from the address bar and kept only for retry in this browser tab's session storage. The access route uses no-referrer, no-store, noindex and a restrictive script policy.
- Missing connections fail to a usable DM or receipt-support route. A failed check tells buyers not to pay twice.
- `npm run test:toon-method` covers successful verification and invalid, unpaid, wrong-product, refund, dispute, test-mode, offline and unconfigured cases with fixtures. These tests do not constitute a real checkout test.

## Required before enabling direct checkout or purchase-optimized ads

### 1. Deliverable first

Upload the updated `Richmadeit-University-Interactive-Workbook.html` to the existing **private** Supabase bucket `paid-workbooks`, replacing the object of that name. Keep the bucket private. Confirm Chapter 14, “The Toon Method: Build a Cartoon Media Page”, Chapter 15, “Turn Your Toon Skill Into a Paid Offer”, and four Toon templates including the first-offer worksheet are present.

The updated workbook now embeds `The_Toon_Method_WAN3_Visual_Tutorial.mp4` as a downloadable Companion File. Its bytes were verified against the original 108-second video. The HTML is approximately 26.5 MB because it contains the video and original PDF tools. Upload this complete updated file; it gives buyers the tutorial without a separate public video URL. Test Companion Files → tutorial download with an approved buyer Google account, and verify an unapproved account cannot obtain the workbook. Never move the paid workbook or tutorial into this public website repository.

### 2. Dedicated Stripe payment link

Create/confirm the actual **$49 USD one-time Toon Method** Payment Link. Do not use the existing $60 custom-video link. Keep quantity fixed at one and disable adjustments/coupons until the verifier is deliberately updated for them. Any applicable taxes must be disclosed at checkout; the verifier checks the $49 pre-tax subtotal.

Under the link's after-payment setting choose redirect to:

```
https://toonclipz.netlify.app/toon-method/access/?session_id={CHECKOUT_SESSION_ID}
```

Set these in Netlify's environment settings, never in public JavaScript or chat:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Existing server-side live Stripe API key with permission to retrieve Checkout Sessions and expanded payments |
| `TOON_METHOD_PAYMENT_LINK_ID` | Exact `plink_…` ID for the $49 offer |
| `TOON_METHOD_CHECKOUT_URL` | Exact live `https://buy.stripe.com/…` URL for that same link |
| `TOON_METHOD_TELEGRAM_INVITE` | Private `https://t.me/+…` or `https://t.me/joinchat/…` invite |
| `TOON_METHOD_SALES_ENABLED` | Set to `true` only after deliverable and buyer flow checks pass |

The offer endpoint changes the page's purchase button from a clearly labeled DM request to Stripe only when those required settings are present and sales are explicitly enabled. Redeploy after configuring function environment variables.

### 3. Free Telegram inclusion

Create a dedicated private invite for paid Toon Method buyers. A join-request invite allows an admin to check buyers before admitting them. After a verified payment, the access page reveals the join button. The group has no additional purchase step.

The link can be forwarded by a buyer; this route is not per-person Telegram entitlement enforcement. For that, add a Telegram admin bot that issues individual expiring invites and handles membership against the buyer list. Never publish the private link in the page HTML or a public configuration endpoint.

### 4. Fulfillment and recovery

Enable Stripe receipts and payment notifications. Personally approve the Google email and deliver the private tutorial/invite after confirming payment in Stripe. A buyer who closes checkout before the redirect must still receive the package. Monitor all paid transactions, including delayed payments, and reconcile them against delivered access.

This release verifies the checkout return page; it does **not** implement a fulfillment webhook or send automatic email. Stripe recommends webhooks for reliable automatic fulfillment. Add a signature-verified, idempotent webhook and email delivery before scaling beyond manual fulfillment. Do not describe the existing flow as fully automated.

For older/manual buyers whose original checkout did not include the redirect, use the receipt-help route and verify their payment in Stripe before approving their Google email and sending the group invite.

### 5. Genuine live statistics

The on-page TikTok tracker requires the ToonClipz account's official `video.list` authorization. Complete `docs/toon-tiktok-tracker.md`. Until then, the page links to the real profile and does not show invented numbers. When connected, displayed totals cover the most recent 20 posts, not lifetime page totals. The 256K “Remember” figure is explicitly labeled as Rich's September report until independently verified.

### 6. Ad measurement

For a first test, send a 9:16 transformation/result video to this offer page or Instagram DM. Match the ad promise to the actual free watermarked **still**, followed by the optional $49 lesson. Do not advertise a free video or instant automated converter.

Use separate UTM tags for Instagram and TikTok. Record landing visits, free-preview requests received, previews delivered, paid purchases, refunds and buyer-access completion. A DM button click is not a delivered lead or a purchase. This release does not add a new Meta/TikTok conversion pixel or claim verified Purchase event tracking for the $49 funnel. Before purchase-optimized ads, configure and test that product's paid conversion event, deduplication and consent settings as applicable. The existing $60 confirmation script identifies a different offer and must not be copied unchanged.

Confirm your refund and delivery terms and make them available before accepting payment. No invented refund deadline, income promise, production guarantee, or celebrity endorsement is used on the page.

## Real end-to-end release check

1. Open the live page on a real phone, including the Instagram/TikTok in-app browsers. Check both sliders, the free DM, buyer access and purchase button.
2. Run Stripe's test-mode flow separately; test payments must never expose the live Telegram group. The production verifier deliberately accepts live sessions only.
3. Confirm the live $49 link has the correct product, price and return URL. Use the next authorized real customer purchase to verify the full live path; do not charge a card solely for this audit without authorization.
4. Verify that the paid return shows the join button, Telegram opens the intended group, the approved Google account opens the updated chapter, and the video tutorial is available.
5. Verify the manual recovery route for a buyer who closes checkout, uses a different Google email, or requests the invitation later.

## Research consulted

- Stripe, Payment Links post-payment: https://docs.stripe.com/payment-links/post-payment
- Stripe, Checkout fulfillment (redirects plus webhooks): https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted
- Baymard, checkout friction audit (clear cost, action labels, recovery and confirmation): https://baymard.com/blog/audit-checkout-flow-hidden-friction
- Telegram, invite links: https://core.telegram.org/api/invites

These principles inform the changes. Conversion improvements must be measured with real traffic; no audit can establish a “highest-converting” guarantee.
