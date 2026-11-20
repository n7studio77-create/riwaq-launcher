create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
drop policy if exists "Admins can read their own role" on public.site_admins;
create policy "Admins can read their own role"
  on public.site_admins for select
  to authenticated
  using (user_id = (select auth.uid()));
grant select on public.site_admins to authenticated;

create or replace function public.sync_initial_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) = '77kmf13@gmail.com'
     and new.email_confirmed_at is not null then
    insert into public.site_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  else
    delete from public.site_admins where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_initial_owner_role() from public, anon, authenticated;
drop trigger if exists sync_initial_owner_role on auth.users;
create trigger sync_initial_owner_role
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_initial_owner_role();

insert into public.site_admins (user_id)
select id
from auth.users
where lower(email) = '77kmf13@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do nothing;

create table if not exists public.catalog_items (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('game', 'mod', 'translation')),
  title text not null check (char_length(title) between 1 and 100),
  subtitle text not null check (char_length(subtitle) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  platform text not null check (char_length(platform) between 1 and 80),
  tag text not null check (char_length(tag) between 1 and 60),
  image_url text not null check (image_url ~* '^https://'),
  color text not null default '#637052' check (color ~* '^#[0-9a-f]{6}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.catalog_items(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.catalog_item_links (
  item_id text primary key references public.catalog_items(id) on delete cascade,
  source_url text not null check (
    source_url ~* '^https://' or source_url ~ '^storage://game-files/[a-f0-9-]+/download\.zip$'
  ),
  created_at timestamptz not null default now()
);

alter table public.catalog_items enable row level security;
alter table public.user_library enable row level security;
alter table public.catalog_item_links enable row level security;

drop policy if exists "Anyone can view catalog items" on public.catalog_items;
create policy "Anyone can view catalog items"
  on public.catalog_items for select
  to anon, authenticated
  using (true);

drop policy if exists "Owners can add catalog items" on public.catalog_items;
create policy "Owners can add catalog items"
  on public.catalog_items for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can update catalog items" on public.catalog_items;
create policy "Owners can update catalog items"
  on public.catalog_items for update
  to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

drop policy if exists "Owners can delete catalog items" on public.catalog_items;
create policy "Owners can delete catalog items"
  on public.catalog_items for delete
  to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

drop policy if exists "Users can view their own library" on public.user_library;
create policy "Users can view their own library"
  on public.user_library for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add to their own library" on public.user_library;
create policy "Users can add to their own library"
  on public.user_library for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.catalog_items where id = item_id)
  );

drop policy if exists "Users can remove from their own library" on public.user_library;
create policy "Users can remove from their own library"
  on public.user_library for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members can view sources in their library" on public.catalog_item_links;
create policy "Members can view sources in their library"
  on public.catalog_item_links for select
  to authenticated
  using (
    exists (
      select 1 from public.user_library
      where user_id = (select auth.uid()) and item_id = catalog_item_links.item_id
    )
    or exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

drop policy if exists "Owners can manage catalog sources" on public.catalog_item_links;
create policy "Owners can manage catalog sources"
  on public.catalog_item_links for all
  to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

grant select on public.catalog_items to anon, authenticated;
grant insert, update, delete on public.catalog_items to authenticated;
grant select, insert, delete on public.user_library to authenticated;
revoke all on public.catalog_item_links from anon;
grant select, insert, update, delete on public.catalog_item_links to authenticated;

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

do $$
begin
  if to_regclass('public.games') is not null then
    execute 'drop policy if exists "Anyone can view games" on public.games';
  end if;
end
$$;

