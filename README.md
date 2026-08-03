# ToonClipz Live Tools

Everything needed to run the live "upload your photo, get a free toon" flow:
a submission page for viewers, a queue widget for OBS, and the Supabase
backend that connects them.

## Files

| File | What it's for |
|---|---|
| `index.html` | The viewer-facing upload page. This is your "link in bio." |
| `queue.html` | Live queue preview — add as an OBS Browser Source so chat can see who's up next. |
| `supabase-setup.sql` | Creates the database table + storage policies. Run once. |
| `obs-assets/stream-layout-vicecity.png` | Today's stream background — load as an OBS Image Source, not part of the website. |

## 1. Set up Supabase (one-time)

1. Go to your Supabase project → **Storage** → **New bucket**
   - Name it exactly `toonclipz-uploads`
   - Toggle **Public** ON
2. Go to the **SQL Editor** → paste in the contents of `supabase-setup.sql` → Run
3. Go to **Settings → API** and copy two values:
   - **Project URL**
   - **anon public key**

## 2. Add your Supabase credentials

Open both `index.html` and `queue.html` in a text editor. Near the top of the
`<script>` section in each, replace:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

with the two values from step 1. Same two values, pasted into both files.

> The anon key is meant to be public/client-side — that's how Supabase is
> designed. The RLS policies in `supabase-setup.sql` are what actually control
> access. This setup is fine for a casual public giveaway; don't reuse this
> exact open-access pattern for anything sensitive later.

## 3. Push to GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Initial commit — ToonClipz live tools"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/toonclipz-live.git
git push -u origin main
```

(Create the empty repo on github.com first, then use its URL in the
`remote add` line above.)

## 4. Deploy on Netlify (connected to GitHub)

1. netlify.com → **Add new site → Import an existing project**
2. Connect GitHub → select this repo
3. Build command: leave blank. Publish directory: leave as `/` (root)
4. Deploy

From now on, any `git push` to `main` auto-redeploys the live site — no
manual drag-and-drop needed.

Your live URL (e.g. `https://toonclipz.netlify.app`) is what goes in your
TikTok bio.

## 5. OBS setup for tonight

- **Background:** Image Source → `obs-assets/stream-layout-vicecity.png` → full 1080×1920 canvas
- **Queue widget:** Browser Source → your live `queue.html` URL (e.g. `https://toonclipz.netlify.app/queue.html`) → size **1032 × 334** → position inside "THE PROMPTS" zone
- **Admin queue (for you only):** on `index.html`, tap the small dot bottom-right, enter code `rich` (change `ADMIN_CODE` in `index.html` if you want a different one)

## Notes

- Full-size finished files: still handled manually — you send them yourself
  once someone pays. No pricing is shown anywhere on the site or the stream
  background by design.
- If you ever want the old scrolling-ticker overlay back, it's not part of
  this repo, but the concept still works the same way as `queue.html` does
  (a small transparent Browser Source layered on top of the background).
