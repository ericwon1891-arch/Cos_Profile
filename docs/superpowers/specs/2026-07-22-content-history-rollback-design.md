# site_content 변경 이력 & 롤백 — 설계

## 배경 / 목적

`portfolio-cosplay`의 관리자 계정은 1개뿐이며, 관리자 세션(JWT)이 탈취될 경우 `site_content` 테이블의 각 섹션 `data`를 통째로 덮어써 콘텐츠를 사실상 지울 수 있다. 현재 스키마(`supabase/schema.sql`)는 `site_content`에 `delete` 정책이 없어 행 자체를 지울 수는 없지만, `update` 정책이 `using(true) with check(true)`라 내용 덮어쓰기는 막지 못한다. 덮어써진 이전 값은 어디에도 남지 않는다.

반면 Storage `media` 버킷은 이미 안전하다 — `update`/`delete` 정책이 없고, 업로드마다 `Date.now()-파일명`으로 새 경로를 쓰기 때문에(`ImageField.jsx`) 기존 이미지를 지우거나 덮어쓸 방법이 API상 없다. 따라서 이번 작업은 유일한 실제 위험 지점인 `site_content` 텍스트/구조 데이터에만 한정한다.

## 범위

- `site_content`가 실제로 변경될 때마다(값이 달라질 때만) 변경 **전** 값을 자동으로 별도 이력 테이블에 저장
- 섹션별로 최근 5개 이력만 유지 (초과분 자동 삭제)
- 복원은 관리자 UI 없이 Supabase 대시보드 SQL Editor에서 수동으로 수행
- Storage(`media`)는 이미 안전하므로 다루지 않음
- Supabase 프로젝트 자체가 삭제되는 재해적 시나리오(오프플랫폼 백업)는 이번 범위 밖 — 관리자 계정 탈취 시나리오만 방어한다

## 스키마 설계 (`supabase/update-content-history.sql`)

```sql
create table site_content_history (
  id bigserial primary key,
  section text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

alter table site_content_history enable row level security;

create policy "site_content_history authenticated read"
  on site_content_history for select
  to authenticated
  using (true);
```

`site_content_history`에는 `select` 정책만 존재하고 `insert`/`update`/`delete` 정책은 의도적으로 만들지 않는다. PostgREST를 통한 API 요청(관리자 JWT 포함)은 이 테이블에 쓰기 작업을 전혀 할 수 없다 — 유일한 쓰기 경로는 아래 트리거뿐이다.

## 트리거 설계

```sql
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
```

**핵심 보안 포인트**: 트리거 함수는 `security definer`로 정의해 테이블 소유자 권한으로 실행된다. 즉 `authenticated` 롤이 `site_content`를 업데이트할 때 트리거 내부의 `insert`/`delete`는 RLS를 우회해서 동작하지만, `authenticated` 롤이 `site_content_history`에 직접 API로 쓰기를 시도하면 정책이 없어 거부된다. 관리자 세션이 탈취돼도 공격자는 이력을 지우거나 조작할 수 없고, 오직 이 트리거를 통한 자동 기록/자동 정리만 가능하다.

`new.data is distinct from old.data` 조건으로 실제 내용 변경이 없는 단순 재저장(`updated_at`만 갱신되는 경우 등)은 이력에 쌓지 않는다 — 5개 슬롯이 무의미한 재저장으로 낭비되는 것을 방지한다.

`offset 5`는 `archived_at` 내림차순 정렬 기준 상위 5개(최신 5개)를 제외한 나머지를 삭제하므로, 트리거 실행 후 섹션당 이력은 항상 5개 이하로 유지된다.

## 복원 절차 (수동, Supabase 대시보드 SQL Editor)

```sql
-- 특정 섹션을 가장 최근 저장된 이력으로 복원
update site_content sc
set data = h.data, updated_at = now()
from site_content_history h
where sc.section = 'hero'          -- 복원할 섹션 이름으로 교체
  and h.section = 'hero'
  and h.archived_at = (
    select max(archived_at)
    from site_content_history
    where section = 'hero'
  );
```

특정 시점을 지정해 복원하려면 `archived_at` 서브쿼리를 원하는 이력 행의 `id` 조건으로 바꾼다. 이 절차는 README나 UPDATE_HISTORY에 별도로 문서화하지 않고, 이 설계 문서를 참조 지점으로 둔다.

## 검증 계획

이 작업은 프론트엔드 코드 변경이 없는 순수 SQL 마이그레이션이므로 Vitest 단위 테스트 대상이 아니다. 대신 마이그레이션 적용 후 Supabase SQL Editor에서 수동으로 검증한다:

1. 임의 섹션의 `data`를 6회 연속 다른 값으로 update → `site_content_history`에 해당 섹션 행이 5개만 남는지 확인
2. `data`는 그대로 두고 `updated_at`만 바뀌는 update(또는 동일 값 재저장) → 이력이 추가로 쌓이지 않는지 확인
3. `authenticated` 롤(anon key + 로그인 세션)로 `site_content_history`에 직접 insert/update/delete 시도 → 전부 거부되는지 확인
4. 위 복원 SQL로 실제 섹션 하나를 이전 값으로 되돌려 공개 페이지에 반영되는지 확인

## 영향받는 기존 파일

없음 — 신규 마이그레이션 파일 `supabase/update-content-history.sql` 추가만으로 완결된다. 기존 애플리케이션 코드(`useSectionContent`, `AdminDashboard` 등)는 수정하지 않는다.
