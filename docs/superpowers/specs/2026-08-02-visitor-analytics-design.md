# 방문자 분석 — 설계

## 배경 / 목적

`portfolio-cosplay`는 행사 주최자·브랜드 담당자·팬에게 보여주는 포트폴리오 사이트지만, 현재는 방문 트래픽을 전혀 알 수 없다. 관리자(나나리 본인)가 얼마나 많은 사람이 방문하는지, 어디서 유입되는지(인스타그램, 검색, 직접 방문 등), 어떤 콘텐츠에 반응이 좋은지 확인할 수 있어야 한다.

외부 유료 분석 툴(Plausible 등) 대신, 비용이 들지 않는 Supabase 기반 자체 구축을 선택했다 — 이미 Supabase를 BaaS로 쓰고 있어 추가 인프라 없이 확장 가능하다.

## 범위

- 공개 페이지 방문 시 페이지뷰를 자동 기록 (경로, 레퍼러, 익명 방문자 ID)
- `/admin` 관리자 대시보드에 "방문자 분석" 탭 추가 — 총 방문/순 방문자, 일별 추이, 유입 경로(레퍼러) Top 5
- 관리자 자신의 방문(로그인 세션, `/admin/*` 경로)은 통계에서 제외
- 범위 밖: IP 기반 지역/국가 분석, 실시간(라이브) 방문자 표시, 이벤트 단위 트래킹(클릭, 스크롤 등), 섹션/콘텐츠 단위 분석 — 공개 사이트가 `/` 단일 경로 SPA(섹션 이동은 `react-scroll` 앵커 스크롤이라 URL이 바뀌지 않음)이므로 "인기 경로"는 의미가 없어 다루지 않는다. 페이지뷰 단위만 다루며, 데이터 보존 기간 제한(자동 삭제)도 이번 범위에 포함하지 않는다.

## 데이터 모델 (`supabase/update-page-views.sql`)

```sql
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
```

`update`/`delete` 정책은 만들지 않는다 — 한번 기록된 페이지뷰는 수정·삭제될 API 경로가 없다. `anon` 롤에 `insert`만 열려있고 `select`는 없으므로, 공격자가 임의로 삽입은 가능해도(스팸 방지는 범위 밖 — 개인 포트폴리오 사이트 트래픽 규모상 우선순위 낮음) 조회나 조작은 할 수 없다. `path`/`referrer` 길이 제한으로 과도한 payload 삽입을 막는다.

`site_content`/`site_content_history`와 달리 이 테이블은 익명 사용자가 직접 쓰기 때문에 별도 신규 마이그레이션 파일로 분리한다.

## 프론트엔드 트래킹

`src/hooks/usePageTracking.js` 신규 훅:

- `react-router-dom`의 라우트 변경(및 SPA 특성상 최초 마운트) 시 `page_views`에 insert
- `visitor_id`: 최초 방문 시 `crypto.randomUUID()`로 생성해 `localStorage`(`cosplay_visitor_id`)에 저장, 이후 재사용 — 개인정보 아닌 순수 랜덤 값
- `useAuth()`의 세션이 존재하면(관리자로 로그인된 상태) 기록하지 않음
- 경로가 `/admin`으로 시작하면 기록하지 않음
- `App.jsx`에서 라우팅 최상단에 훅 호출 한 줄만 추가

## 관리자 대시보드 — "방문자 분석" 탭

`AdminDashboard`에 섹션 메뉴 추가 (`VisitorAnalytics.jsx` 신규 컴포넌트). 기간 토글(7일/30일/전체) 후 `page_views`를 `created_at` 범위로 fetch해 클라이언트에서 집계:

- **총 방문 수**: fetch된 행 개수
- **순 방문자 수**: `visitor_id` distinct count
- **일별 방문 추이**: 날짜별 group by → 막대그래프. 차트 라이브러리 추가 없이 `div` 높이(%) 기반 CSS 막대로 구현 (기존 번들 크기 경고 있음, 신규 의존성 지양)
- **유입 경로 Top 5**: `referrer`에서 도메인만 추출(`new URL(referrer).hostname`)해 group by. `referrer`가 null이거나 사이트 자신의 도메인(same-origin)이면 "직접 방문"으로 표시 — 배포 도메인(`cos-profile.vercel.app`)에서 자체 리다이렉트 시 레퍼러가 남는 경우를 실제 유입으로 오분류하지 않기 위함

`path` 컬럼은 향후 라우트가 늘어날 가능성에 대비해 계속 기록하되, 지금은 대시보드에 노출하지 않는다.

전체 raw row를 fetch하는 방식은 현재 트래픽 규모(개인 포트폴리오)에서는 충분하다. 트래픽이 크게 늘면 Postgres 집계 함수(RPC)로 전환할 수 있으나 지금은 YAGNI로 제외한다.

## 에러 처리

- 트래킹 insert 실패(네트워크 오류 등)는 조용히 무시 — 공개 페이지 사용자 경험에 영향 없어야 하며, `console.error`로만 남긴다
- 관리자 대시보드 조회 실패 시 빈 상태 메시지 + "다시 시도" 버튼 표시

## 테스트

- `usePageTracking`: 관리자 세션/‘/admin’ 경로일 때 insert를 호출하지 않는지, `visitor_id`가 localStorage에서 재사용되는지 유닛 테스트 (Supabase mock)
- `VisitorAnalytics`: 레퍼러 도메인 파싱 함수, 날짜별 그룹핑 함수를 순수 함수로 분리해 유닛 테스트. 컴포넌트 자체는 기존 패턴대로 Supabase fetch mock 후 집계 결과 렌더링만 스모크 테스트

## 영향받는 기존 파일

- `supabase/update-page-views.sql` (신규)
- `src/hooks/usePageTracking.js` (신규)
- `src/components/admin/sections/VisitorAnalytics.jsx` (신규)
- `src/App.jsx` — `usePageTracking()` 훅 호출 추가
- `src/components/admin/AdminDashboard.jsx` — "방문자 분석" 메뉴 항목 추가
