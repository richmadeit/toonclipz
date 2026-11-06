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
- URL session reference is removed before analytics; tab-local recovery retains only the reference and always re-verifies Stripe on reload. Keep Stripe's receipt.
- No admin/submission payment status is changed here; reconcile payments in Stripe. Do not fulfill based solely on a frontend event.
- New $5 package orders start at `/submit/?tier=30&checkout=deposit` (also 60 and 180). Uploaded objects are checked before the server saves materials and issues the existing Stripe deposit link with the same unique `client_reference_id`. A failed or uncertain save never opens checkout.
- The return page verifies Stripe and matches the private order receipt. Already-saved materials are not requested again. Older deposit links without a prepared-order reference automatically show the paid intake, with a full-page fallback.
- `/status.html` uses its existing owner login to show freshly verified paid deposits matched to submitted materials. It refreshes every 30 seconds while visible, and needs the owner to review actual media/links. It does not send push notifications or customer messages.
- Test, unpaid, refunded, disputed, wrong-link and mismatched-amount checkouts cannot mark an order ready. No credentials, table policies or bucket permissions were added.
- Regression coverage: `node --test tests/*.test.mjs`. Mock tests do not represent a real purchase. `GET /.netlify/functions/deposit-order` is a read-only private-store availability probe, not proof of a database insert or purchase.

