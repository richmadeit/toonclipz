# Rich Buys iPhones — ToonClipz add-on

## Page addresses

- Store: `/rich-buys-iphone/`
- Your order dashboard: `/rich-buys-iphone/admin.html`
- Buyer order status: `/rich-buys-iphone/track.html`
- Paid-buyer pack shell: `/rich-buys-iphone/buyer-bonus-pack.html`
- API: `/.netlify/functions/rbi-chips?route=config`

Use the lowercase address. It is a separate page inside ToonClipz, not a replacement homepage. The original ToonClipz homepage, CSS, JavaScript, assets, admin, queue, and SQL are unchanged. The chip dashboard is separate from the ToonClipz dashboard; chip orders do not automatically appear in the ToonClipz queue.

## What is included

Six supplier-labeled chip families, quantity controls, a five-chip mixed minimum, $15 each for 5–9, $13 each for 10–19, and repair-shop approval/manual quoting for 20+. The 9-to-10 price difference is disclosed. Shipping and tax are quoted before payment.

The 14 Pro / Pro Max and 17 Pro Max cards have their own external supplier tutorial links. They are links, not embedded video files or independently verified instructions. Other model tutorials remain pending. The unrelated 12/12 Pro video is excluded. Product photos are the supplied chip photos, resized as WebP; no invented installation picture is used.

Payment is manual. Rich must verify the actual funds in the payment app before marking paid. Only then does the API return the buyer prompt pack and Telegram invite. Incoming batch updates and individual outbound tracking are separate. There is no automatic payment verification, SMS sender, or carrier polling.

## Netlify build

Connect this repository and deploy the merged branch. `netlify.toml` runs `node scripts/build-site.mjs` and publishes `dist/`; functions are built separately from `netlify/functions/`. No extra npm packages are needed. The build preserves the current ToonClipz web files, including `assets/`, `toon.css`, and `toon.js`. Add future public site files to `WEB_ENTRIES` in the build script.

Do not publish the repository root. Do not force a redirect that only adds a trailing slash; Netlify normalizes slash variants. The earlier `/iphone-chips/` path redirects to the new lowercase directory.

## Private setup before taking orders

**The page can be deployed before this setup, but preorders remain closed.**

Use the owner-only setup ZIP provided in this conversation. Never upload it to this public repository. Privately run these scripts in Supabase SQL Editor, in order:

1. `database/01-create-chip-tables.sql`
2. `database/02-order-transactions.sql`
3. `database/03-private-content-table.sql`
4. `database/04-LOAD-PAID-PROMPTS-KEEP-PRIVATE.sql`

They use separate `rbi_chips_` tables/RPCs. Keep public browser roles denied. The full paid prompt text belongs in the private database table, not this repository or public HTML.

Create your Supabase Auth owner account. In Netlify environment settings (Functions scope), add:

- `RBI_SITE_URL`: exact HTTPS site origin, **without** `/rich-buys-iphone/`.
- `RBI_SUPABASE_URL`
- `RBI_SUPABASE_PUBLISHABLE_KEY`
- `RBI_SUPABASE_SECRET_KEY`
- `RBI_ADMIN_USER_IDS`: allowed owner Auth user UUID(s), comma-separated.
- `RBI_TURNSTILE_SITE_KEY`
- `RBI_TURNSTILE_SECRET_KEY`

Do not post these credentials in chat or source. The chip app intentionally does not inherit the existing ToonClipz application's keys. Redeploy after adding environment values. Use separate staging credentials for deploy previews.

Open your chip dashboard and sign in. Add your real contact link, Telegram invite, written return/defect policy, and batch dates. Confirm the model instructions and compatibility before approving payment. Approve the launch checklist only after the smoke test below.

## Daily order steps

1. Review the buyer and model mix.
2. Enter the full quote, mailing address, estimated ship-by date, and compatibility notes.
3. Send the buyer their private order link. They accept the quote before payment.
4. Message private payment instructions. Check actual funds, then mark paid.
5. Update the shared batch as it moves to you.
6. After handing the package to the carrier, enter that buyer's carrier and tracking number.

## Live smoke test

Check the original ToonClipz homepage, video, upload flow, queue and admin. Check the chip page on mobile, mixed quantities and both tutorial links. Before configuration the API must return `ready:false` and submission must remain disabled.

On a staging database, complete an authorized owner sign-in, a request with Turnstile, quote acceptance, verified test payment, private bonus access, batch updates and outbound tracking. Check that an unpaid buyer, wrong key and non-owner are denied. Check real HTTPS cookies, refresh persistence, mobile Safari and cross-device access. Do not accept real payment until this works.

GitHub file delivery alone does not configure Netlify, Supabase, payment accounts, Telegram or carrier services. Missing product tutorials and hardware compatibility still need owner verification.

## References

Netlify: https://docs.netlify.com/build/functions/get-started/
Netlify build isolation: https://docs.netlify.com/build/configure-builds/overview/
Netlify slash normalization: https://docs.netlify.com/manage/routing/redirects/redirect-options/
