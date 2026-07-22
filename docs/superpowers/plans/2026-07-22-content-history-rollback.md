# site_content 변경 이력 & 롤백 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 세션이 탈취돼 `site_content`가 덮어써지더라도, 섹션별 최근 5개 이전 버전을 DB에서 수동 SQL로 복원할 수 있게 만든다.

**Architecture:** `site_content_history` 테이블을 신규 생성하고, `site_content`에 `AFTER UPDATE` 트리거를 걸어 값이 실제로 바뀔 때마다 이전 값을 자동 보관한다. 트리거 함수는 `security definer`로 실행돼 RLS를 우회해서 쓰기/정리를 하지만, `site_content_history` 테이블 자체는 `authenticated` 롤에게 `select`만 허용한다.

**Tech Stack:** PostgreSQL (Supabase), 순수 SQL 마이그레이션 — 애플리케이션 코드/프론트엔드 변경 없음

## Global Constraints

- 이번 작업은 `site_content` 텍스트/구조 데이터만 다룬다 — Storage(`media`)는 이미 안전하므로 손대지 않는다 (참조: `docs/superpowers/specs/2026-07-22-content-history-rollback-design.md`)
- `site_content_history`에는 `select` 정책만 만든다. `insert`/`update`/`delete` 정책은 절대 추가하지 않는다 — 유일한 쓰기 경로는 트리거뿐이어야 한다
- 섹션별 이력은 항상 최근 5개까지만 유지한다 (초과분 자동 삭제)
- 값이 실제로 바뀐 경우(`data` 변경)에만 이력을 남긴다 — 단순 재저장은 기록하지 않는다
- 복원은 관리자 UI를 만들지 않고 Supabase 대시보드 SQL Editor에서 수동으로 수행한다
- 이 작업은 순수 SQL 마이그레이션이라 Vitest 단위 테스트 대상이 아니다. 검증은 Supabase SQL Editor에서 수동으로 수행한다

---

## Task 1: 마이그레이션 파일 작성

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\supabase\update-content-history.sql`

**Interfaces:**
- Produces: `site_content_history` 테이블, `fn_archive_site_content_history()` 함수, `trg_site_content_archive` 트리거 — Task 2가 Supabase 프로젝트에 그대로 실행한다

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

`C:\Users\Eric\portfolio-cosplay\supabase\update-content-history.sql` 파일을 아래 내용으로 새로 만든다.

```sql
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
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add supabase/update-content-history.sql
git commit -m "feat: site_content 변경 이력 테이블/트리거 마이그레이션 추가"
```

---

## Task 2: Supabase 프로젝트에 적용 및 검증

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`

**Interfaces:**
- Consumes: Task 1에서 작성한 `supabase/update-content-history.sql`

- [ ] **Step 1: Supabase 대시보드에 마이그레이션 적용**

Supabase 프로젝트 대시보드 → SQL Editor에서 `supabase/update-content-history.sql`의 전체 내용을 붙여넣고 실행한다.

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE FUNCTION`, `CREATE TRIGGER`가 각각 에러 없이 성공.

- [ ] **Step 2: 이력이 실제로 쌓이고 5개로 제한되는지 검증**

같은 SQL Editor에서 아래를 실행해 임의 섹션(`about`)을 6번 연속 다른 값으로 업데이트한다.

```sql
do $$
begin
  for i in 1..6 loop
    update site_content
    set data = jsonb_build_object('test_marker', i)
    where section = 'about';
  end loop;
end $$;

select count(*) from site_content_history where section = 'about';
```

Expected: `count`가 정확히 `5`.

- [ ] **Step 3: 동일 값 재저장 시 이력이 쌓이지 않는지 검증**

```sql
select count(*) from site_content_history where section = 'about';
-- 위 결과를 아래 update 전후로 비교

update site_content
set data = data
where section = 'about';

select count(*) from site_content_history where section = 'about';
```

Expected: `update` 전후로 `count` 값이 동일 (변화 없음).

- [ ] **Step 4: authenticated 롤이 이력 테이블에 직접 쓸 수 없는지 검증**

```sql
set role authenticated;

insert into site_content_history (section, data, updated_at)
values ('about', '{}'::jsonb, now());
```

Expected: `new row violates row-level security policy for table "site_content_history"` 에러.

```sql
delete from site_content_history where section = 'about';
```

Expected: 에러 없이 실행되지만 `DELETE 0` (정책이 없어 대상 행이 조회되지 않음 — 실질적으로 아무것도 지워지지 않음).

```sql
reset role;
```

- [ ] **Step 5: `about` 섹션 테스트 데이터를 원래 값으로 복원**

Step 2~4에서 `about` 섹션에 테스트용 `test_marker` 값을 넣었으므로, 실제 운영 데이터로 되돌린다.

```sql
update site_content sc
set data = h.data, updated_at = now()
from site_content_history h
where sc.section = 'about'
  and h.section = 'about'
  and h.archived_at = (
    select min(archived_at) from site_content_history where section = 'about'
  );
```

Expected: `about` 섹션의 `data`가 테스트 이전 원래 내용으로 복원됨. 공개 사이트(`https://cos-profile.vercel.app`)의 About 섹션을 새로고침해 실제 원래 텍스트가 표시되는지 눈으로 확인한다.

- [ ] **Step 6: 작업 이력 문서화**

`C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`을 열어 `## 배포` 섹션 바로 위에 아래 항목을 추가한다.

```markdown
## 2026-07-22 — site_content 변경 이력 및 롤백

- `site_content_history` 테이블 + `AFTER UPDATE` 트리거 추가 (섹션별 최근 5개 변경 이력 자동 보관)
- 트리거 함수는 `security definer`로 실행, `site_content_history`는 `authenticated` 롤에 `select`만 허용 — 관리자 세션이 탈취돼도 이력 자체는 API로 조작 불가
- 복원은 관리자 UI 없이 Supabase SQL Editor에서 수동 수행 (절차: `docs/superpowers/specs/2026-07-22-content-history-rollback-design.md` 참고)

```

- [ ] **Step 7: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add docs/UPDATE_HISTORY.md
git commit -m "docs: site_content 이력/롤백 기능 적용 및 검증 완료 기록"
```
