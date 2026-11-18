-- Private bucket for the full colour CSV reports.
-- Object path: {auth.uid()}/{image_id}.csv – the first folder is the owner.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 52428800, array['text/csv'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "reports: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "reports: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Needed for upsert (re-uploading the same report).
create policy "reports: owner can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "reports: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
