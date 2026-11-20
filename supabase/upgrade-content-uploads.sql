alter table public.catalog_item_links
  drop constraint if exists catalog_item_links_source_url_check;
alter table public.catalog_item_links
  drop constraint if exists catalog_item_links_source_url_format_check;
alter table public.catalog_item_links
  add constraint catalog_item_links_source_url_format_check
  check (
    source_url ~* '^https://' or source_url ~ '^storage://game-files/[a-f0-9-]+/download\.zip$'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('game-files', 'game-files', false, 500000000000, array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
  ('game-covers', 'game-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view uploaded games" on storage.objects;

drop policy if exists "Members can download catalog ZIPs" on storage.objects;
create policy "Members can download catalog ZIPs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'game-files'
    and (
      exists (
        select 1 from public.user_library
        where user_id = (select auth.uid())
          and item_id = (storage.foldername(name))[1]
      )
      or exists (select 1 from public.site_admins where user_id = (select auth.uid()))
    )
  );

drop policy if exists "Owners can upload catalog ZIPs" on storage.objects;
create policy "Owners can upload catalog ZIPs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-files'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can update catalog ZIPs" on storage.objects;
create policy "Owners can update catalog ZIPs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'game-files'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'game-files'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can delete catalog ZIPs" on storage.objects;
create policy "Owners can delete catalog ZIPs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-files'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Anyone can view game covers" on storage.objects;
create policy "Anyone can view game covers"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'game-covers');

drop policy if exists "Owners can upload game covers" on storage.objects;
create policy "Owners can upload game covers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-covers'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can update game covers" on storage.objects;
create policy "Owners can update game covers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'game-covers'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'game-covers'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can delete game covers" on storage.objects;
create policy "Owners can delete game covers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-covers'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

