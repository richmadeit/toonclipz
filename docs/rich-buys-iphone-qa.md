# Chip add-on verification — 2026-09-19

## Executed locally

- 91 Node tests passed, zero failed. These combine the existing private owner-package test suite with six build/catalog integration tests in this repository. Domains exercised include minimums and tiers, invalid input, mixed models, shop-only bulk, quote/payment state checks, private buyer access, admin authorization mocks, database adapter calls, namespaced environment handling, batch updates, and carrier links.
- 38 Chromium render/interaction checks passed, with no uncaught script errors in that run. The storefront fits widths 320, 375, 390, 768, and 1440. All six source-derived photos render. Pricing boundaries, a 2+3 mix, invalid quantity handling, exact tutorial destinations, disabled preview submission, and locked paid-pack display were checked. Secondary pages were checked at 320, 390, and 1440.
- The publish-list test uses temporary fixtures and verifies byte preservation and exclusion of server, SQL, and private files. Existing production ToonClipz assets are preserved through their original Git blob references, not reconstructed from screenshots.

## Reproduce public integration tests

Run `node --test tests/rbi-build.test.mjs`. These six tests contain no paid prompts or buyer records. The full earlier suite remains in the owner-only package, not the public repository.

## Scope limits

Browser navigation is blocked by the work environment, including localhost. Browser checks used self-contained copies of the actual source with `set_content`. Production CSP was removed only in those local owner previews to allow inline testing. This is not a hosted routing, CSP enforcement, real authentication cookie, or live database test.

No Supabase SQL was executed on the owner's database. No production request, payment, Telegram join, or carrier shipment was created. Netlify deployment and real configured services must pass the smoke test in `rich-buys-iphone.md`. Preorders fail closed until setup is complete.

Supplier links were attached based on owner-provided model mappings. External tutorial playback and hardware compatibility were not independently verified. They are not embedded video files. No 12/12 Pro video is used on the 14–17 listings.
