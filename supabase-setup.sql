-- ============================================================
-- ToonClipz Upload Tool — Supabase Setup
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste → Run
-- ============================================================

-- 1) The submissions table
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null,
  platform text not null,
  image_url text not null,
  code text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table submissions enable row level security;

-- Anyone can submit a new entry (this is the public upload form)
create policy "Allow public insert" on submissions
  for insert to anon
  with check (true);

-- Anyone can read entries (needed so the admin queue view can list them)
create policy "Allow public read" on submissions
  for select to anon
  using (true);

-- Anyone can toggle "done" (used by the admin queue's Done button)
create policy "Allow public update" on submissions
  for update to anon
  using (true)
  with check (true);


-- ============================================================
-- 2) Storage bucket — IMPORTANT: create this part in the dashboard first
-- ============================================================
-- Go to Storage → New bucket → name it exactly:  toonclipz-uploads
-- Toggle "Public bucket" ON, then come back and run the policies below.

create policy "Allow public uploads to toonclipz-uploads"
on storage.objects for insert
to anon
with check (bucket_id = 'toonclipz-uploads');

create policy "Allow public read of toonclipz-uploads"
on storage.objects for select
to anon
using (bucket_id = 'toonclipz-uploads');

-- ============================================================
-- Done. Now grab your Project URL + anon public key from
-- Settings → API, and paste them into the HTML file's
-- SUPABASE_URL and SUPABASE_ANON_KEY constants near the top.
-- ============================================================
