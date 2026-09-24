# ToonClipz

The homepage remains the $60 custom-video application and Stripe order flow. The separate `/toon-method/` route presents a $49 learn-it-yourself package for clippers. Buyer payment and delivery are handled personally by DM.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | $60 ToonClipz custom-video application and payment flow |
| `/toon-method/` | $49 Toon Method lesson offer for clippers |
| `/custom-video/` | Existing $60 custom-video application and payment flow |
| Portfolio videos | Existing media hosted at `https://richmadeit.netlify.app/preview/` |
| `/admin.html`, `/queue.html` | Existing legacy live-giveaway tools; these do not receive campaign applications |
| `/rich-buys-iphone/` | Separate repair-chip preorder storefront |
| `/rich-buys-iphone/admin.html` | Separate chip-order dashboard |
| `/rich-buys-iphone/track.html` | Private chip-order status |

The chip add-on is documented in [docs/rich-buys-iphone.md](docs/rich-buys-iphone.md).
It does not change ToonClipz applications or their admin destination.
Chip preorders remain closed until the private account/database setup is complete.
Do not upload the paid prompt pack or owner-only setup ZIP to this public repository.

The old free-reveal homepage has been replaced. There is no `/live/` copy.
The old homepage remains recoverable through Git history.

## Recovery source

Recovered from `preview/index.html` in `richmadeit/richmadeit-submissions`
at commit `357e0b9161ac9132551b6821cc42c58749be1ded`.
That repository's standard preview was restored in commit
`6716118478e69f726788e1000d670e9c52ad785f`; this recovery changes only
`richmadeit/toonclipz`.

The dedicated homepage renders ToonClipz branding and selects Cinematic
Toon without query parameters. Purchase intent and permissions remain
unchecked. Campaign attribution is always `toonclipz`, including visits
with unrelated advertising query parameters. Other recovered look options
remain available.

## Applications and admin

The campaign uses the existing RichMadeIt Supabase project
`molqlfdjlmnlkscecngz`, the `submissions` storage bucket, and the
`submissions` table. Review these applications in the existing
[RichMadeIt admin](https://richmadeit.netlify.app/admin/).

The recovered database contract is preserved: Cinematic Toon is stored as
`style: realistic`, with the explicit requested look and `Source: toonclipz`
in the contact field. This requires no schema migration. Tracking includes
the `cinematic_toon` variant; the Lead event fires only after a successful
database insert. Contact details and optional permissions follow the
recovered form's existing rules.

The old `supabase-setup.sql` belongs only to the legacy giveaway backend
(`pamizjfazcuofekzjekm`). Do not run it against the RichMadeIt project for
this campaign. The existing legacy admin, queue, and OBS assets are retained.

## Hosting

Use `netlify.toml`: build with `node scripts/build-site.mjs` and publish
`dist/`. The build copies the existing public ToonClipz pages, `toon.css`,
`toon.js`, `assets/`, and `obs-assets/`, plus `/rich-buys-iphone/`.
It excludes the chip server code, SQL, tests, and owner-only material.
Netlify builds the namespaced chip function separately. This replaces the
old root-publish/no-build setting; no npm dependencies are required.

Portfolio videos use absolute URLs to the existing RichMadeIt media; posters
are embedded. This avoids duplicating the videos and does not change the
standard preview page. Keep those five media URLs available when updating
the RichMadeIt site.
Free-lesson links point to the existing
[RichMadeIt University](https://richmadeit.netlify.app/university/).

For a local static preview, build first, then serve `dist/`.
When checking the ToonClipz form, mock the Supabase client to avoid creating
test applications in the production queue. Static serving does not start
the chip API. See the add-on setup guide for its required private services.

## Interactive landing-page update

The homepage includes a keyboard/touch photo-to-toon reveal (`toon.js`), a responsive cream/purple toon design (`toon.css`), and the complete 15-second DDG fan-concept example in `assets/toonclipz-example.mp4`. The example is labeled as AI animation with no affiliation or endorsement. The existing artist portfolio remains available in an expandable section.

The offer remains: apply free, preview if selected, $20 to unlock the exact clean 15-second clip. New concepts, revisions and longer clips are separate. Applications retain the same questions, upload bucket and table, record Source: toonclipz plus sanitized utm_source/utm_campaign, and appear in RichMadeIt's admin. Optional showcase and teaching permissions are not preselected. Existing homepage tracking is preserved by the chip add-on; it does not copy those pixels onto the chip storefront.

The RichMadeIt admin update displays source, requested look, creative idea and permissions, includes these in the copied/downloaded brief, and uses the $20/15-second email and SMS templates for ToonClipz applications. Messages are not sent automatically.

Earlier campaign validation covered JavaScript syntax, mocked submission success/failure/retry, duplicate-submit prevention, accurate 15-second selection, source and consent preservation, admin metadata parsing, and media duration. No production test application was submitted. The chip add-on's separate verification scope is in [docs/rich-buys-iphone-qa.md](docs/rich-buys-iphone-qa.md).
