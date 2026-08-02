-- 방문자 페이지뷰를 기록하는 테이블. 공개 사이트에서 익명(anon) 사용자가 직접 insert한다.
-- select는 관리자(authenticated)만 가능 — 방문자 자신은 기록을 조회할 수 없다.
-- update/delete 정책은 없다 — 한 번 기록된 페이지뷰는 API로 수정/삭제할 수 없다.

create table page_views (
  id bigserial primary key,
  path text not null check (char_length(path) <= 200),
  referrer text check (referrer is null or char_length(referrer) <= 500),
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table page_views enable row level security;

create policy "page_views anon insert"
  on page_views for insert
  to anon, authenticated
  with check (true);

create policy "page_views authenticated read"
  on page_views for select
  to authenticated
  using (true);
