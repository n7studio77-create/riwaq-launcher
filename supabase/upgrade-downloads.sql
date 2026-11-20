alter table public.games add column if not exists download_url text;
alter table public.games alter column file_path drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_single_download_source'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_single_download_source
      check ((file_path is null) <> (download_url is null));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_https_download_url'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_https_download_url
      check (download_url is null or download_url ~* '^https://');
  end if;
end
$$;

update storage.buckets
set file_size_limit = 500000000000,
    allowed_mime_types = array['application/zip', 'application/x-zip-compressed']
where id = 'game-files';
