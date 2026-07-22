-- 섹션별 최근 5개 변경 이력을 자동 보관하는 테이블 + 트리거
-- 관리자 세션이 탈취돼 site_content가 덮어써지더라도 복원할 수 있게 한다.

create table site_content_history (
  id bigserial primary key,
  section text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

alter table site_content_history enable row level security;

-- select만 허용한다. insert/update/delete 정책은 의도적으로 만들지 않는다.
-- authenticated 롤이 API를 통해 이 테이블에 직접 쓰기를 시도하면 항상 거부되어야 한다.
create policy "site_content_history authenticated read"
  on site_content_history for select
  to authenticated
  using (true);

create or replace function fn_archive_site_content_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.data is distinct from old.data then
    insert into site_content_history (section, data, updated_at)
    values (old.section, old.data, old.updated_at);

    delete from site_content_history
    where id in (
      select id from site_content_history
      where section = old.section
      order by archived_at desc
      offset 5
    );
  end if;

  return new;
end;
$$;

create trigger trg_site_content_archive
  after update on site_content
  for each row
  execute function fn_archive_site_content_history();
