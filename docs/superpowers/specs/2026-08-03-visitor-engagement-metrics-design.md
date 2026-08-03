# 방문자 참여도 지표 (체류시간 · 섹션 조회 · 캐릭터 클릭) — 설계

## 배경 / 목적

`2026-08-02-visitor-analytics-design.md`로 구축한 방문자 분석(총 방문/순 방문자/일별 추이/유입 경로)이 실제 운영 중 배포됐다. 관리자가 이어서 알고 싶어하는 것은 "얼마나 머무는지", "Hero만 보고 나가는지 Contact까지 다 내려보는지", "어떤 캐릭터가 인기 있는지" — 즉 방문 **횟수**를 넘어선 **참여도(engagement)** 지표다.

## 범위

- 방문자가 사이트에 머문 시간(체류 시간) 측정 및 평균값 표시
- 공개 페이지의 각 섹션(Hero/About/Strength/Career/캐릭터 서브섹션들/Available/SNS/Services/Personality/Contact)이 실제로 화면에 노출됐는지 섹션별 조회수로 집계
- 대표 캐릭터 카드 클릭(모달 오픈) 횟수를 캐릭터별로 집계해 인기 캐릭터 Top 5 표시
- 기존 `page_views` 테이블·`usePageTracking` 훅은 그대로 유지하되, 관리자 제외 판정 로직을 새 코드와 공유하도록 리팩터링
- 범위 밖: 섹션별 도달 퍼널(단계별 이탈률) — 이번엔 섹션당 단순 조회수만. 캐릭터 클릭도 섹션별이 아닌 전체 통합 랭킹만 다룬다

## 데이터 모델 (`supabase/update-page-events.sql`)

```sql
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
```

`page_views`(방문 자체 기록)와 성격이 다른 이벤트성 데이터라 별도 테이블로 분리한다. `event_type`별로 `label`/`value` 쓰임이 다르다:

| event_type | label | value |
|---|---|---|
| `duration` | (없음, null) | 체류 초 |
| `section_view` | 섹션 라벨("Hero", 캐릭터 서브섹션의 `heading` 등) | (없음, null) |
| `character_click` | 캐릭터 제목 | (없음, null) |

RLS는 `page_views`와 동일한 패턴: `anon`+`authenticated` insert만, `authenticated` select만, update/delete 없음.

## 공용 추적 헬퍼

### `src/lib/analytics.js`에 순수 함수 추가

```js
export function canTrackVisit({ pathname, session, loading }) {
  if (loading) return false
  if (session) return false
  return !pathname.startsWith('/admin')
}
```

기존 `usePageTracking.js`의 인라인 3단 가드(`if (loading) return` 등)를 이 함수로 대체한다 — 관리자 제외 판정을 한 곳에서 관리해 섹션 조회·캐릭터 클릭 추적과 로직이 벌어지지 않게 한다.

### `src/lib/tracking.js` (신규) — Supabase insert 래퍼

```js
import { supabase } from './supabaseClient'

export function insertPageView({ path, referrer, visitorId }) {
  return supabase
    .from('page_views')
    .insert({ path, referrer, visitor_id: visitorId })
    .then(({ error }) => {
      if (error) console.error('페이지뷰 기록 실패', error)
    })
}

export function insertEvent({ eventType, label = null, value = null, visitorId }) {
  return supabase
    .from('page_events')
    .insert({ event_type: eventType, label, value, visitor_id: visitorId })
    .then(({ error }) => {
      if (error) console.error('이벤트 기록 실패', error)
    })
}
```

`usePageTracking.js`가 기존 `page_views` insert 로직을 이 파일의 `insertPageView`로 위임하도록 리팩터링한다 (동작은 동일, 코드 위치만 정리).

## 체류 시간 추적 (`src/hooks/useVisitDuration.js`, 신규)

- 마운트 시각을 `ref`에 저장
- `document.visibilitychange` 이벤트에서 `document.visibilityState === 'hidden'`이 되는 순간(탭 전환·닫기·페이지 이탈 시 가장 먼저, 가장 안정적으로 발생) 경과 초를 계산해 1회만 전송 (`sentRef`로 중복 전송 방지)
- 탭 종료 도중에도 요청이 끊기지 않도록 `supabase-js`를 거치지 않고 **raw `fetch`에 `keepalive: true`**로 `page_events`에 직접 POST (표준 "페이지 이탈 시 비콘 전송" 패턴 — `fetch`는 `keepalive` 옵션을 지원하지만 `supabase-js` 클라이언트는 이 옵션을 노출하지 않는다)
- `canTrackVisit()`으로 관리자/`/admin` 제외는 동일하게 적용 (마운트 시점의 값을 ref에 캡처해 unload 시점에 사용)

## 섹션 조회 추적 (`src/hooks/useSectionViewTracking.js`, 신규)

- 공개 페이지의 모든 `<section>` 요소에 사람이 읽을 라벨을 `data-track-label` 속성으로 부여 (`HeroSection` 등 정적 섹션은 하드코딩된 라벨, `CharacterSectionBlock`은 이미 갖고 있는 `section.heading`을 그대로 사용)
- `IntersectionObserver`(threshold 0.5)로 각 섹션이 화면에 50% 이상 노출되면 `section_view` 이벤트를 1회만 기록 (이미 기록한 라벨은 `Set`으로 스킵)
- 캐릭터 서브섹션은 Supabase 데이터 로딩 후 비동기로 DOM에 추가되므로, `MutationObserver`로 새로 삽입되는 `section[data-track-label]` 요소를 감지해 자동으로 관찰 대상에 추가
- `PageTracker`(App.jsx) 안에서 `usePageTracking()`과 함께 호출

## 캐릭터 클릭 추적 (`CharacterSectionBlock.jsx` 수정)

- 카드 클릭 시 모달을 여는 기존 `setSelectedWork(work)` 호출 지점에서, `useAuth()` + `useLocation()`으로 얻은 값을 `canTrackVisit()`에 넣어 통과하면 `insertEvent({ eventType: 'character_click', label: work.title, visitorId: getOrCreateVisitorId() })` 호출
- 섹션 구분 없이 캐릭터 제목 기준으로 전체 통합 집계 (같은 제목이 여러 섹션에 있는 경우는 이번 범위에서 고려하지 않음 — 현재 데이터상 캐릭터 제목은 섹션 내에서만 관리되고 사이트 전체에 중복 방지 규칙이 없으므로, 동명 캐릭터가 있으면 합산되는 것을 허용한다)

## 대시보드 표시 (`VisitorAnalytics.jsx` 확장)

기존 `page_views` 조회에 더해 같은 기간 범위로 `page_events`도 함께 조회(`Promise.all`):

- **평균 체류 시간**: `event_type='duration'`인 행들의 `value` 평균 → "총 방문 수/순 방문자 수" 옆에 세 번째 통계 카드로 "N분 M초" 형식 표시
- **섹션별 조회수**: `event_type='section_view'`를 `label` 기준 group by, **전체를 조회수 내림차순으로 나열** (Top-N 제한 없음 — "단순 조회수" 요구사항)
- **인기 캐릭터 Top 5**: `event_type='character_click'`를 `label` 기준 group by, 내림차순 상위 5개 (기존 "유입 경로 Top 5"와 동일한 리스트 UI 재사용)

`src/lib/analytics.js`에 추가할 순수 집계 함수:

```js
export function averageDuration(rows) // duration 이벤트만 필터해 평균 초(반올림) 반환, 0건이면 null
export function sectionViewCounts(rows) // section_view 이벤트를 label별로 세어 내림차순 전체 반환
export function topCharacterClicks(rows, limit = 5) // character_click 이벤트를 label별로 세어 내림차순 상위 N
```

## 에러 처리

- 모든 신규 트래킹 호출(체류시간/섹션조회/캐릭터클릭)은 실패해도 조용히 무시 — 기존 `page_views` insert와 동일하게 `console.error`만 남기고 UX에 영향 없음
- 대시보드의 `page_events` 조회 실패 시 기존 "다시 시도" 에러 UI를 그대로 재사용 (두 쿼리 중 하나라도 실패하면 에러 상태로 처리)

## 테스트

- `analytics.js`: `canTrackVisit`, `averageDuration`, `sectionViewCounts`, `topCharacterClicks` 순수 함수 유닛 테스트 (엣지 케이스: 빈 배열, duration 0건일 때 null)
- `tracking.js`: `insertPageView`/`insertEvent`가 올바른 테이블·payload로 supabase를 호출하는지 유닛 테스트 (mock)
- `usePageTracking.js`: 기존 테스트를 리팩터링된 구현에 맞게 유지 (동작 동일, `canTrackVisit`/`insertPageView` 위임 확인)
- `useVisitDuration.js`: `visibilitychange` 이벤트 발생 시 경과 시간을 계산해 (mock한) `fetch`가 `keepalive:true`로 1회만 호출되는지, 관리자/`/admin`일 때는 호출되지 않는지 테스트
- `useSectionViewTracking.js`: `IntersectionObserver`/`MutationObserver`를 mock해 교차 시 라벨별로 1회만 이벤트가 기록되는지, 이미 기록한 라벨은 중복 기록되지 않는지 테스트
- `CharacterSectionBlock`: 카드 클릭 시 `insertEvent`가 캐릭터 제목으로 호출되는지, 관리자 세션이면 호출되지 않는지 테스트
- `VisitorAnalytics`: 평균 체류시간/섹션별 조회수/인기 캐릭터 렌더링을 (mock한) 두 테이블 데이터로 검증

## 영향받는 기존 파일

- `supabase/update-page-events.sql` (신규)
- `src/lib/analytics.js` — `canTrackVisit`, `averageDuration`, `sectionViewCounts`, `topCharacterClicks` 추가
- `src/lib/tracking.js` (신규) — `insertPageView`, `insertEvent`
- `src/hooks/usePageTracking.js` — `canTrackVisit`/`insertPageView`로 위임하도록 리팩터링 (동작 동일)
- `src/hooks/useVisitDuration.js` (신규)
- `src/hooks/useSectionViewTracking.js` (신규)
- `src/App.jsx` — `PageTracker`에 새 훅 2개 호출 추가
- `src/components/HeroSection.jsx`, `AboutSection.jsx`, `StrengthSection.jsx`, `CareerSection.jsx`, `AvailableSection.jsx`, `SnsSection.jsx`, `ServicesSection.jsx`, `PersonalitySection.jsx`, `ContactSection.jsx` — 각 `<section>`에 `data-track-label` 속성 추가
- `src/components/CharacterSectionBlock.jsx` — `section.heading`을 `data-track-label`로, 카드 클릭 시 `character_click` 이벤트 추가
- `src/components/admin/sections/VisitorAnalytics.jsx` — 평균 체류시간 카드, 섹션별 조회수 리스트, 인기 캐릭터 Top 5 리스트 추가
