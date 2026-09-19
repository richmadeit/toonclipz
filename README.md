# ToonClipz

The homepage is the recovered ToonClipz music-video campaign: apply free,
review a watermarked 15-second preview if selected, and pay $20 to unlock
that exact clip. No payment is collected by the application form.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | ToonClipz campaign and artist application |
| Portfolio videos | Existing media hosted at `https://richmadeit.netlify.app/preview/` |
| `/admin.html`, `/queue.html` | Existing legacy live-giveaway tools; these do not receive campaign applications |

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

This is a static site: publish the repository root, with no build command.
Portfolio videos use absolute URLs to the existing RichMadeIt media; posters
are embedded. This avoids duplicating the videos and does not change the
standard preview page. Keep those five media URLs available when updating
the RichMadeIt site.
Free-lesson links point to the existing
[RichMadeIt University](https://richmadeit.netlify.app/university/).

For a local preview, run `python3 -m http.server 8000` from this directory.
When checking the form, mock the Supabase client to avoid creating test
applications in the production queue.
