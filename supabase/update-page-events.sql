-- 방문자 참여도 이벤트(체류시간/섹션조회/캐릭터클릭)를 기록하는 범용 테이블.
-- event_type별로 label/value 쓰임이 다르다:
--   duration        -> label: null,          value: 체류 초
--   section_view    -> label: 섹션 라벨,      value: null
--   character_click -> label: 캐릭터 제목,    value: null
-- page_views와 마찬가지로 공개 사이트에서 익명(anon) 사용자가 직접 insert한다.
-- select는 관리자(authenticated)만 가능. update/delete 정책은 없다.

create table page_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('duration', 'section_view', 'character_click')),
  label text check (label is null or char_length(label) <= 200),
  value integer check (value is null or value >= 0),
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table page_events enable row level security;

create policy "page_events anon insert"
  on page_events for insert
  to anon, authenticated
  with check (true);

create policy "page_events authenticated read"
  on page_events for select
  to authenticated
  using (true);
