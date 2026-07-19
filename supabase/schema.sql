create table site_content (
  section text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table site_content enable row level security;

create policy "site_content public read"
  on site_content for select
  using (true);

create policy "site_content authenticated insert"
  on site_content for insert
  to authenticated
  with check (true);

create policy "site_content authenticated update"
  on site_content for update
  to authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');
