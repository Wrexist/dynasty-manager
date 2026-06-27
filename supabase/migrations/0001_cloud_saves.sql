-- Cloud Save (Online Slice 1) — private per-user save backups in Supabase Storage.
--
-- Each player gets a folder named after their auth uid. Manual Back up / Restore
-- (src/utils/cloudSave.ts) writes one object per save slot plus a small `.meta`
-- sidecar used by the Settings list. Anonymous auth gives every install a uid
-- with zero friction; a later "Sign in with Apple" upgrade (phase 1b) keeps the
-- same uid via Supabase identity linking, so backups carry over.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting into the SQL
-- editor of the dynasty-manager project.
--
-- REQUIRES, in addition to this migration:
--   Authentication → Providers → "Allow anonymous sign-ins" = ON.
-- Without it, signInAnonymously() fails and the feature reports "unavailable".

-- Private bucket (no public read; all access is via RLS-checked authenticated calls).
insert into storage.buckets (id, name, public)
values ('saves', 'saves', false)
on conflict (id) do nothing;

-- RLS: a user may only touch objects under a top-level folder equal to their uid.
-- storage.foldername(name)[1] is the first path segment of "<uid>/slot_1".
-- Wrapping auth.uid() in a scalar subselect lets Postgres cache it per statement.
create policy "cloud saves: own read"
  on storage.objects for select to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "cloud saves: own insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "cloud saves: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "cloud saves: own delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = (select auth.uid()::text));
