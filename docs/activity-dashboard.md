# ToonClipz activity dashboard

Open `/status.html`. Anonymous traffic collection starts at deployment; no historical traffic is backfilled.

## One-time setup

In Netlify → Project configuration → Environment variables, add `TOONCLIPZ_DASHBOARD_PASSWORD` with a unique password of at least 16 characters. Mark it secret and include the Functions scope. Set it only in the production context, then redeploy. Enter that password on `/status.html`. Never put it in GitHub or in client JavaScript. Rotating it invalidates existing 12-hour sessions.

Stripe uses existing `STRIPE_SECRET_KEY` and `STRIPE_PAYMENT_LINK_IDS`. The live key must be able to list Checkout Sessions and read expanded charges. No new Stripe key or webhook is required. A connection error shows unavailable, never a false zero. Only live, paid, complete USD payment-link checkouts with a $25 subtotal from the allowed store are counted. $1 tests and sandbox payments are excluded. Purchases are selected by Checkout Session creation time, so a session created outside the reporting window but paid inside it is not included. Revenue is amount collected minus refunds, including tax, before fees and costs; it is not profit. Direct payment-link purchases are included, even if the buyer never returns to the website.

## Metrics and privacy

- Page views: landing-page loads, excluding admin/dashboard. Visits: anonymous per-tab sessions; 30-minute inactivity expiration is checked on page load. Not unique people.
- Recent visitors: sessions that sent an action in the last five minutes. Not a claim they are still online. No heartbeat polling on customer pages.
- Steps: independent session counts. Checkout means navigating to Stripe, never a purchase. Saved details are a browser signal after the existing submission service reports success.
- Sources: allowlisted category derived from `utm_source` or referrer domain. No full URLs, queries, names, email, IP addresses, uploaded files, field values or card details are persisted in this feature.
- Honors browser GPC, DNT, `window.toonclipzAnalyticsConsent === false`, and owner exclusion in localStorage. Known bot user agents are ignored. Browser blockers and spoofable public events mean traffic counts are estimates.
- Public collector accepts only known event types, same-origin requests, UUID-shaped identifiers, and limits each daily session to 60 events. Atomic conditional writes prevent lost concurrent updates; event IDs deduplicate retries.
- Login is checked server-side with constant-time comparison, secure HttpOnly SameSite cookies, platform rate limits and no-store responses. No password is published. The existing legacy `admin.html` is unrelated and has not been rewritten.

## Operation and limits

Uses the site-wide private Netlify Blobs store `toonclipz-traffic-v1` and `@netlify/blobs`. No separate paid analytics subscription is installed; Netlify functions/storage usage still counts toward the host's plan. Dashboard refreshes every 30 seconds while visible; a short authenticated server cache reduces repeated reads. Last 24 hours or 7 days; times display in the viewer's timezone. Reads cap at 2,000 daily-session records and 500 Stripe checkouts, with explicit incomplete-data warnings. This is intended for the current small-volume campaign, not high-volume analytics.

Cleanup runs daily to remove traffic sessions older than 30 days. Stripe data is fetched read-only and is not stored. Meta events, checkout flow and existing verification stay unchanged. No ad spend integration: this does not calculate ROAS or profit or confirm Meta attribution.

## Verification

`node --test tests/activity.test.mjs tests/payment-verification.test.mjs` tests access control, expiry, origin checks, event PII stripping and purchase forgery rejection, duplicate handling, independent steps, Stripe payment filters/refunds/pagination/errors. `node scripts/build-site.mjs` builds the explicit public allowlist.

After deployment, configure the dashboard password and sign in. Turn on “Exclude my visits” in your own browser. For an intentional traffic check use a separate browser with tracking allowed, visit `/?utm_source=instagram`, click Get started and interact with the form. Refresh the dashboard after 30 seconds. A public POST of a purchase event must be rejected. No new payment is necessary: existing live $25 Stripe checkouts in the selected window should be shown.
