# Payment confirmation setup

Card entry stays on Stripe. The website displays details only after server-side Checkout Session verification.

## Netlify environment variables (Functions scope)
- `STRIPE_TEST_SECRET_KEY`: sandbox secret key, entered securely in Netlify.
- `STRIPE_TEST_PAYMENT_LINK_IDS`: allowed sandbox Payment Link API IDs (`plink_...`), comma separated.
- `STRIPE_SECRET_KEY`: live secret key, entered securely in Netlify.
- `STRIPE_PAYMENT_LINK_IDS`: allowed live Payment Link API IDs (`plink_...`), comma separated.

Redeploy after configuring. Never commit keys or put them in frontend scripts. The Payment Link API ID is different from its buy.stripe.com URL token.

Only after sandbox verification works, set Stripe Payment Link > After payment > Don't show confirmation page to:

`https://toonclipz.netlify.app/payment-confirmation.html?session_id={CHECKOUT_SESSION_ID}`

Retain the literal placeholder. Repeat separately for live after live keys/allowlist are ready. Do not enable the redirect while verification returns 503.

## Tracking and limitations
- Purchase is queued to pixel 1066699776252161 only after a verified, paid live checkout. Sandbox and fully refunded payments do not send Purchase.
- Stable event ID and browser localStorage prevent normal same-browser reload duplicates. This is browser tracking, not a webhook/CAPI integration. Ad blockers, closed tabs, storage clearing and other browsers can affect delivery/deduplication. Confirm actual receipt in Meta Events Manager; queued does not mean received.
- URL session reference is removed before loading Meta to avoid sending it through the page URL. Reloading the stripped URL shows a neutral screen; keep Stripe's receipt.
- No admin/submission payment status is changed here; reconcile payments in Stripe. Do not fulfill based solely on a frontend event.
- Required materials remain collected before checkout. A direct payment without client_reference_id displays instructions to match the materials manually.
- Test with `node --test tests/payment-verification.test.mjs`.
