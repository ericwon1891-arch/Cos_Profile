# 방문자 참여도 지표 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방문자의 평균 체류 시간, 섹션별 조회수, 캐릭터 카드 클릭 랭킹을 `/admin` "방문자 분석" 탭에 추가한다.

**Architecture:** 새 `page_events` 테이블(이벤트 종류별 범용 테이블)에 3가지 신호를 기록한다 — 체류 시간은 `visibilitychange`+`fetch(keepalive:true)`로 페이지 이탈 시 1회 전송, 섹션 조회는 각 섹션에 `data-track-label`을 달고 `IntersectionObserver`+`MutationObserver`로 방문당 1회 기록, 캐릭터 클릭은 카드 클릭 핸들러에서 직접 기록. 관리자 제외 판정(`canTrackVisit`)과 insert 래퍼(`insertPageView`/`insertEvent`)를 공용 모듈로 분리해 기존 `usePageTracking.js`도 함께 리팩터링한다.

**Tech Stack:** React 19 + react-router-dom(useLocation) + Supabase(Postgres/RLS) + 브라우저 표준 `IntersectionObserver`/`MutationObserver`/`visibilitychange`/`fetch(keepalive)` — 신규 npm 의존성 없음.

## Global Constraints

- `page_events` RLS: `insert`는 `anon`+`authenticated` 모두 허용, `select`는 `authenticated`만 허용, `update`/`delete` 정책은 만들지 않는다. `event_type`은 `check`로 `'duration'`/`'section_view'`/`'character_click'` 세 값만 허용한다 (참조: `docs/superpowers/specs/2026-08-03-visitor-engagement-metrics-design.md`)
- 체류시간/섹션조회/캐릭터클릭 모두 관리자 세션 또는 `/admin`으로 시작하는 경로에서는 기록하지 않는다 — 판정은 반드시 공용 함수 `canTrackVisit({ pathname, session, loading })` 하나로만 한다 (중복 구현 금지)
- 체류시간 전송은 `supabase-js`가 아니라 raw `fetch`에 `keepalive: true`를 써서 페이지 종료 중에도 요청이 끊기지 않게 한다
- 섹션 조회는 방문(마운트)당 라벨별로 최대 1회만 기록한다
- "섹션별 조회수"는 Top-N 제한 없이 전체를 내림차순으로 보여준다. "인기 캐릭터"는 상위 5개까지만 보여준다 (기존 "유입 경로 Top 5"와 동일한 리스트 UI 재사용)
- 신규 npm 의존성을 추가하지 않는다
- 기존 `usePageTracking.js`를 `canTrackVisit`/`insertPageView` 공용 헬퍼로 리팩터링하되, 관찰 가능한 동작(어떤 조건에서 몇 번 어떤 payload로 insert하는지)은 리팩터링 전후로 동일해야 한다
- Supabase 클라이언트·`fetch`는 모든 테스트에서 mock으로 대체한다 — 실제 네트워크 호출 금지
- `.js` 파일(`.jsx` 아님) 안에서 테스트가 JSX가 필요하면 `React.createElement`를 쓴다 (이 프로젝트의 Vite 설정은 `.js` 파일의 JSX 구문을 파싱하지 못함 — `usePageTracking.test.js`에 이미 적용된 패턴)
- 컴포넌트 테스트 파일은 소스 위치와 무관하게 `src/components/__tests__/`에 평평하게 둔다

---

## Task 1: DB 마이그레이션 파일 작성

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\supabase\update-page-events.sql`

**Interfaces:**
- Produces: `page_events` 테이블(`id`, `event_type`, `label`, `value`, `visitor_id`, `created_at`) — Task 11에서 Supabase 프로젝트에 실제 적용한다. Task 3(`insertEvent`), Task 10(`VisitorAnalytics`)이 이 스키마를 그대로 사용한다.

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

`C:\Users\Eric\portfolio-cosplay\supabase\update-page-events.sql` 파일을 아래 내용으로 새로 만든다.

```sql
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
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add supabase/update-page-events.sql
git commit -m "feat: page_events 테이블 마이그레이션 추가"
```

---

## Task 2: `src/lib/analytics.js`에 참여도 집계 순수 함수 추가

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\lib\analytics.js`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\lib\analytics.test.js`

**Interfaces:**
- Produces:
  - `canTrackVisit({ pathname: string, session: object|null, loading: boolean }): boolean` — `loading`이면 false, `session`이 있으면(관리자) false, `pathname`이 `/admin`으로 시작하면 false, 나머지는 true
  - `averageDuration(rows: {value: number}[]): number|null` — `value` 평균을 반올림해 반환, 빈 배열이면 `null`
  - `formatDuration(seconds: number|null): string` — `"N분 M초"` 형식, `null`이면 `"-"`
  - `sectionViewCounts(rows: {label: string}[]): {label: string, count: number}[]` — `label`별 카운트, 내림차순 전체
  - `topCharacterClicks(rows: {label: string}[], limit?: number): {label: string, count: number}[]` — `label`별 카운트, 내림차순 상위 N개 (기본 5)
- Consumed by: Task 4(`usePageTracking`)의 `canTrackVisit`, Task 5(`useVisitDuration`)·Task 6(`useSectionViewTracking`)·Task 8(`CharacterSectionBlock`)의 `canTrackVisit`, Task 10(`VisitorAnalytics`)의 `averageDuration`/`formatDuration`/`sectionViewCounts`/`topCharacterClicks`

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\analytics.test.js` 맨 아래(기존 `countUniqueVisitors` describe 블록 뒤)에 아래 내용을 추가한다. 파일 맨 위 import 줄도 새 함수들을 포함하도록 바꾼다.

```diff
-import { getOrCreateVisitorId, getReferrerDomain, groupByDate, topReferrers, countUniqueVisitors } from './analytics'
+import {
+  getOrCreateVisitorId,
+  getReferrerDomain,
+  groupByDate,
+  topReferrers,
+  countUniqueVisitors,
+  canTrackVisit,
+  averageDuration,
+  formatDuration,
+  sectionViewCounts,
+  topCharacterClicks,
+} from './analytics'
```

파일 맨 끝에 추가:

```js
describe('canTrackVisit', () => {
  it('loading 중이면 false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: null, loading: true })).toBe(false)
  })

  it('세션이 있으면(관리자) false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: { user: { id: '1' } }, loading: false })).toBe(false)
  })

  it('/admin 경로면 false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/admin', session: null, loading: false })).toBe(false)
  })

  it('로딩이 끝났고 세션이 없고 /admin이 아니면 true를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: null, loading: false })).toBe(true)
  })
})

describe('averageDuration', () => {
  it('value들의 평균을 반올림해 반환한다', () => {
    const rows = [{ value: 10 }, { value: 15 }, { value: 20 }]
    expect(averageDuration(rows)).toBe(15)
  })

  it('행이 없으면 null을 반환한다', () => {
    expect(averageDuration([])).toBeNull()
  })
})

describe('formatDuration', () => {
  it('초를 "N분 M초" 형식으로 변환한다', () => {
    expect(formatDuration(125)).toBe('2분 5초')
  })

  it('null이면 -을 반환한다', () => {
    expect(formatDuration(null)).toBe('-')
  })
})

describe('sectionViewCounts', () => {
  it('label별로 세어 내림차순 전체를 반환한다', () => {
    const rows = [{ label: 'Hero' }, { label: 'Hero' }, { label: 'Contact' }]
    expect(sectionViewCounts(rows)).toEqual([
      { label: 'Hero', count: 2 },
      { label: 'Contact', count: 1 },
    ])
  })
})

describe('topCharacterClicks', () => {
  it('label별로 세어 내림차순 상위 N개를 반환한다', () => {
    const rows = [{ label: 'A' }, { label: 'A' }, { label: 'B' }, { label: 'C' }]
    expect(topCharacterClicks(rows, 2)).toEqual([
      { label: 'A', count: 2 },
      { label: 'B', count: 1 },
    ])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/analytics.test.js`
Expected: FAIL — `canTrackVisit is not a function` (아직 구현 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\analytics.js` 맨 끝에 아래 함수들을 추가한다.

```js

export function canTrackVisit({ pathname, session, loading }) {
  if (loading) return false
  if (session) return false
  return !pathname.startsWith('/admin')
}

export function averageDuration(rows) {
  if (rows.length === 0) return null
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return Math.round(total / rows.length)
}

export function formatDuration(seconds) {
  if (seconds === null) return '-'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}분 ${remaining}초`
}

function countByLabel(rows, limit = Infinity) {
  const counts = {}
  for (const row of rows) {
    counts[row.label] = (counts[row.label] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

export function sectionViewCounts(rows) {
  return countByLabel(rows)
}

export function topCharacterClicks(rows, limit = 5) {
  return countByLabel(rows, limit)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/analytics.test.js`
Expected: PASS — 19 tests passed (기존 9개 + 신규 10개)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/lib/analytics.js src/lib/analytics.test.js
git commit -m "feat: 참여도 지표 집계 순수 함수 추가 (canTrackVisit/averageDuration/formatDuration/sectionViewCounts/topCharacterClicks)"
```

---

## Task 3: `src/lib/tracking.js` — Supabase insert 래퍼

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\lib\tracking.js`
- Create: `C:\Users\Eric\portfolio-cosplay\src\lib\tracking.test.js`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabaseClient.js`)
- Produces: `insertPageView({ path, referrer, visitorId }): Promise<void>`, `insertEvent({ eventType, label?, value?, visitorId }): Promise<void>` — Task 4가 `insertPageView`를, Task 6·Task 8이 `insertEvent`를 사용한다

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\tracking.test.js` 파일을 아래 내용으로 새로 만든다.

```js
import { insertPageView, insertEvent } from './tracking'
import { supabase } from './supabaseClient'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('insertPageView', () => {
  it('page_views 테이블에 올바른 payload로 insert한다', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })

    await insertPageView({ path: '/', referrer: null, visitorId: 'v1' })

    expect(supabase.from).toHaveBeenCalledWith('page_views')
    expect(insert).toHaveBeenCalledWith({ path: '/', referrer: null, visitor_id: 'v1' })
  })

  it('insert 실패 시 콘솔에 에러를 남기고 예외를 던지지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insert = vi.fn().mockResolvedValue({ error: { message: '실패' } })
    supabase.from.mockReturnValue({ insert })

    await insertPageView({ path: '/', referrer: null, visitorId: 'v1' })

    expect(consoleSpy).toHaveBeenCalledWith('페이지뷰 기록 실패', { message: '실패' })
    consoleSpy.mockRestore()
  })
})

describe('insertEvent', () => {
  it('page_events 테이블에 올바른 payload로 insert한다', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })

    await insertEvent({ eventType: 'section_view', label: 'Hero', visitorId: 'v1' })

    expect(supabase.from).toHaveBeenCalledWith('page_events')
    expect(insert).toHaveBeenCalledWith({ event_type: 'section_view', label: 'Hero', value: null, visitor_id: 'v1' })
  })

  it('insert 실패 시 콘솔에 에러를 남기고 예외를 던지지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insert = vi.fn().mockResolvedValue({ error: { message: '실패' } })
    supabase.from.mockReturnValue({ insert })

    await insertEvent({ eventType: 'duration', value: 42, visitorId: 'v1' })

    expect(consoleSpy).toHaveBeenCalledWith('이벤트 기록 실패', { message: '실패' })
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/tracking.test.js`
Expected: FAIL — `Failed to resolve import "./tracking"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\tracking.js` 파일을 아래 내용으로 새로 만든다.

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

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/tracking.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/lib/tracking.js src/lib/tracking.test.js
git commit -m "feat: page_views/page_events insert 공용 헬퍼(tracking.js) 추가"
```

---

## Task 4: `usePageTracking.js`를 공용 헬퍼로 리팩터링

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.js`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.test.js`

**Interfaces:**
- Consumes: `canTrackVisit`, `getOrCreateVisitorId` (Task 2, `src/lib/analytics.js`), `insertPageView` (Task 3, `src/lib/tracking.js`)
- Produces: `usePageTracking(): void` — 시그니처·외부 동작 동일, Task 9에서 계속 그대로 사용

- [ ] **Step 1: 테스트를 새 구조에 맞게 다시 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.test.js` 파일 전체를 아래 내용으로 교체한다. (관리자/로딩/`/admin` 조합에 따른 세부 분기는 Task 2에서 `canTrackVisit` 자체 테스트로 이미 커버되므로, 이 파일은 훅이 `canTrackVisit`의 반환값에 따라 `insertPageView`를 호출/스킵하는지만 검증한다.)

```js
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { usePageTracking } from './usePageTracking'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertPageView } from '../lib/tracking'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))
vi.mock('../lib/tracking', () => ({
  insertPageView: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

describe('usePageTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateVisitorId.mockReturnValue('visitor-123')
  })

  it('canTrackVisit이 true이면 page_views를 기록한다', async () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    canTrackVisit.mockReturnValue(true)
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    await waitFor(() => expect(insertPageView).toHaveBeenCalledWith({
      path: '/',
      referrer: null,
      visitorId: 'visitor-123',
    }))
    expect(canTrackVisit).toHaveBeenCalledWith({ pathname: '/', session: null, loading: false })
  })

  it('canTrackVisit이 false이면 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    canTrackVisit.mockReturnValue(false)
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(insertPageView).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/usePageTracking.test.js`
Expected: FAIL — `canTrackVisit`/`insertPageView`가 호출되지 않음 (아직 기존 인라인 구현이라 새 mock을 쓰지 않음)

- [ ] **Step 3: 구현 리팩터링**

`C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.js` 파일 전체를 아래 내용으로 교체한다.

```js
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertPageView } from '../lib/tracking'

export function usePageTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

    insertPageView({
      path: location.pathname,
      referrer: document.referrer || null,
      visitorId: getOrCreateVisitorId(),
    })
  }, [location.pathname, session, loading])
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/usePageTracking.test.js`
Expected: PASS — 2 tests passed

- [ ] **Step 5: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: PASS — 112 tests passed (100 기존 + Task 2에서 +10 + Task 3에서 +4 + 이 Task에서 -2)

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/hooks/usePageTracking.js src/hooks/usePageTracking.test.js
git commit -m "refactor: usePageTracking이 canTrackVisit/insertPageView 공용 헬퍼를 쓰도록 정리"
```

---

## Task 5: 체류 시간 추적 훅 (`useVisitDuration`)

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\hooks\useVisitDuration.js`
- Create: `C:\Users\Eric\portfolio-cosplay\src\hooks\useVisitDuration.test.js`

**Interfaces:**
- Consumes: `useAuth()` → `{ session, loading }`, `canTrackVisit`/`getOrCreateVisitorId` (Task 2)
- Produces: `useVisitDuration(): void` — Task 9에서 `App.jsx`의 `PageTracker`가 호출한다

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\useVisitDuration.test.js` 파일을 아래 내용으로 새로 만든다.

```js
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useVisitDuration } from './useVisitDuration'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisitDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateVisitorId.mockReturnValue('visitor-1')
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('탭이 hidden 상태가 되면 keepalive fetch로 체류 시간을 기록한다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/rest/v1/page_events')
    expect(options.keepalive).toBe(true)
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.event_type).toBe('duration')
    expect(body.visitor_id).toBe('visitor-1')
    expect(typeof body.value).toBe('number')
  })

  it('한 번 기록한 뒤 다시 hidden이 되어도 중복 전송하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')
    setVisibility('visible')
    setVisibility('hidden')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('canTrackVisit이 false이면 hidden이 되어도 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(false)
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('visibilityState가 hidden이 아니면 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('visible')

    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/useVisitDuration.test.js`
Expected: FAIL — `Failed to resolve import "./useVisitDuration"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\useVisitDuration.js` 파일을 아래 내용으로 새로 만든다.

```js
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useVisitDuration() {
  const location = useLocation()
  const { session, loading } = useAuth()
  const startRef = useRef(Date.now())
  const sentRef = useRef(false)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'hidden') return
      if (sentRef.current) return
      if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

      sentRef.current = true
      const value = Math.round((Date.now() - startRef.current) / 1000)

      fetch(`${supabaseUrl}/rest/v1/page_events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          event_type: 'duration',
          value,
          visitor_id: getOrCreateVisitorId(),
        }),
      }).catch(err => console.error('체류 시간 기록 실패', err))
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [location.pathname, session, loading])
}
```

`supabase-js`를 거치지 않고 raw `fetch`를 쓰는 이유: `fetch`의 `keepalive` 옵션은 탭이 실제로 닫히는 도중에도 요청이 취소되지 않게 해주는 표준 메커니즘인데, `supabase-js` 클라이언트의 `.insert()`는 이 옵션을 노출하지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/useVisitDuration.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/hooks/useVisitDuration.js src/hooks/useVisitDuration.test.js
git commit -m "feat: 체류 시간 추적 훅(useVisitDuration) 추가"
```

---

## Task 6: 섹션 조회 추적 훅 (`useSectionViewTracking`)

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\hooks\useSectionViewTracking.js`
- Create: `C:\Users\Eric\portfolio-cosplay\src\hooks\useSectionViewTracking.test.js`

**Interfaces:**
- Consumes: `useAuth()` → `{ session, loading }`, `canTrackVisit`/`getOrCreateVisitorId` (Task 2), `insertEvent` (Task 3)
- Produces: `useSectionViewTracking(): void` — Task 9에서 `App.jsx`의 `PageTracker`가 호출한다. `[data-track-label]` 속성이 붙은 요소를 관찰 대상으로 삼는다 — Task 7·8에서 실제 섹션에 이 속성을 붙인다

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\useSectionViewTracking.test.js` 파일을 아래 내용으로 새로 만든다.

```js
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useSectionViewTracking } from './useSectionViewTracking'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertEvent } from '../lib/tracking'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))
vi.mock('../lib/tracking', () => ({
  insertEvent: vi.fn(),
}))

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    this.unobserve = vi.fn()
    MockIntersectionObserver.instances.push(this)
  }
}
MockIntersectionObserver.instances = []

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

describe('useSectionViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    global.IntersectionObserver = MockIntersectionObserver
    getOrCreateVisitorId.mockReturnValue('visitor-1')
    document.body.innerHTML = ''
  })

  it('canTrackVisit이 true이면 화면에 보이는 섹션을 라벨로 기록한다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: true, target: section }])

    expect(insertEvent).toHaveBeenCalledWith({
      eventType: 'section_view',
      label: 'Hero',
      visitorId: 'visitor-1',
    })
  })

  it('같은 섹션이 다시 교차해도 중복 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: true, target: section }])
    instance.callback([{ isIntersecting: true, target: section }])

    expect(insertEvent).toHaveBeenCalledTimes(1)
  })

  it('isIntersecting이 false인 엔트리는 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: false, target: section }])

    expect(insertEvent).not.toHaveBeenCalled()
  })

  it('canTrackVisit이 false이면 IntersectionObserver를 만들지 않는다', () => {
    canTrackVisit.mockReturnValue(false)
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it('MutationObserver로 나중에 추가된 섹션도 관찰 대상에 포함한다', async () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const section = document.createElement('section')
    section.dataset.trackLabel = 'Characters'
    document.body.appendChild(section)

    await waitFor(() => {
      const instance = MockIntersectionObserver.instances[0]
      expect(instance.observe).toHaveBeenCalledWith(section)
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/useSectionViewTracking.test.js`
Expected: FAIL — `Failed to resolve import "./useSectionViewTracking"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\useSectionViewTracking.js` 파일을 아래 내용으로 새로 만든다.

```js
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertEvent } from '../lib/tracking'

export function useSectionViewTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

    const seen = new Set()

    function handleIntersect(entries) {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const label = entry.target.dataset.trackLabel
        if (!label || seen.has(label)) continue
        seen.add(label)
        insertEvent({ eventType: 'section_view', label, visitorId: getOrCreateVisitorId() })
      }
    }

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.5 })

    function observeAll() {
      document.querySelectorAll('[data-track-label]').forEach(el => observer.observe(el))
    }

    observeAll()

    const mutationObserver = new MutationObserver(observeAll)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [location.pathname, session, loading])
}
```

캐릭터 서브섹션은 Supabase 데이터가 로딩된 뒤 비동기로 DOM에 추가되므로, 초기 `observeAll()` 한 번만으로는 놓친다 — `MutationObserver`로 이후 추가되는 `[data-track-label]` 요소도 계속 관찰 대상에 포함시킨다. `observer.observe()`를 이미 관찰 중인 요소에 다시 호출해도 중복 등록되지 않는 것은 `IntersectionObserver` 표준 동작이라 안전하다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/useSectionViewTracking.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/hooks/useSectionViewTracking.js src/hooks/useSectionViewTracking.test.js
git commit -m "feat: 섹션 조회 추적 훅(useSectionViewTracking) 추가"
```

---

## Task 7: 정적 섹션에 `data-track-label` 부여

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\HeroSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\AboutSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\StrengthSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\CareerSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\AvailableSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\SnsSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\ServicesSection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\PersonalitySection.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\ContactSection.jsx`

**Interfaces:**
- Produces: 각 섹션 루트 요소(`<section>` 또는 `<footer>`)에 `data-track-label` 속성 — Task 6의 `useSectionViewTracking`이 `document.querySelectorAll('[data-track-label]')`로 이 요소들을 찾는다

이 9개 컴포넌트는 전부 `docs/superpowers/plans` 관례상("정적 텍스트 섹션은 스냅샷성 테스트를 만들지 않는다") 전용 테스트가 없다. 로딩 스켈레톤과 로딩 완료 후 렌더링 둘 다에 라벨을 붙인다(둘 다 같은 `id`를 가진 것과 동일한 이유 — 어느 시점에 관찰되든 라벨이 있어야 함).

- [ ] **Step 1: 9개 파일에 `data-track-label` 추가**

`C:\Users\Eric\portfolio-cosplay\src\components\HeroSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="hero" className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e]" />
+    return <section id="hero" data-track-label="Hero" className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e]" />
   }
```

```diff
     <section
       id="hero"
+      data-track-label="Hero"
       className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e] flex items-center justify-center text-white text-center px-6 relative overflow-hidden"
     >
```

`C:\Users\Eric\portfolio-cosplay\src\components\AboutSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="about" className="py-20 bg-[#f9f9f7]" />
+    return <section id="about" data-track-label="About Me" className="py-20 bg-[#f9f9f7]" />
   }
```

```diff
-    <section id="about" className="py-20 bg-[#f9f9f7]">
+    <section id="about" data-track-label="About Me" className="py-20 bg-[#f9f9f7]">
```

`C:\Users\Eric\portfolio-cosplay\src\components\StrengthSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="strength" className="py-20 bg-[#0d0d0d]" />
+    return <section id="strength" data-track-label="Strength" className="py-20 bg-[#0d0d0d]" />
   }
```

```diff
-    <section id="strength" className="py-20 bg-[#0d0d0d] text-white">
+    <section id="strength" data-track-label="Strength" className="py-20 bg-[#0d0d0d] text-white">
```

`C:\Users\Eric\portfolio-cosplay\src\components\CareerSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="career" className="py-20 bg-[#f9f9f7]" />
+    return <section id="career" data-track-label="Career" className="py-20 bg-[#f9f9f7]" />
   }
```

```diff
-    <section id="career" className="py-20 bg-[#f9f9f7]">
+    <section id="career" data-track-label="Career" className="py-20 bg-[#f9f9f7]">
```

`C:\Users\Eric\portfolio-cosplay\src\components\AvailableSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="available" className="py-20 bg-[#0d0d0d]" />
+    return <section id="available" data-track-label="Available" className="py-20 bg-[#0d0d0d]" />
   }
```

```diff
-    <section id="available" className="py-20 bg-[#0d0d0d] text-white">
+    <section id="available" data-track-label="Available" className="py-20 bg-[#0d0d0d] text-white">
```

`C:\Users\Eric\portfolio-cosplay\src\components\SnsSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="sns" className="py-20 bg-[#f9f9f7]" />
+    return <section id="sns" data-track-label="SNS" className="py-20 bg-[#f9f9f7]" />
   }
```

```diff
-    <section id="sns" className="py-20 bg-[#f9f9f7]">
+    <section id="sns" data-track-label="SNS" className="py-20 bg-[#f9f9f7]">
```

`C:\Users\Eric\portfolio-cosplay\src\components\ServicesSection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="services" className="py-20 bg-[#0d0d0d]" />
+    return <section id="services" data-track-label="Additional Services" className="py-20 bg-[#0d0d0d]" />
   }
```

```diff
-    <section id="services" className="py-20 bg-[#0d0d0d] text-white">
+    <section id="services" data-track-label="Additional Services" className="py-20 bg-[#0d0d0d] text-white">
```

`C:\Users\Eric\portfolio-cosplay\src\components\PersonalitySection.jsx`:

```diff
   if (loading || !data) {
-    return <section id="personality" className="py-20 bg-[#f9f9f7]" />
+    return <section id="personality" data-track-label="Personality" className="py-20 bg-[#f9f9f7]" />
   }
```

```diff
-    <section id="personality" className="py-20 bg-[#f9f9f7]">
+    <section id="personality" data-track-label="Personality" className="py-20 bg-[#f9f9f7]">
```

`C:\Users\Eric\portfolio-cosplay\src\components\ContactSection.jsx`:

```diff
   if (loading || !data) {
-    return <footer id="contact" className="bg-[#0d0d0d] py-16" />
+    return <footer id="contact" data-track-label="Contact" className="bg-[#0d0d0d] py-16" />
   }
```

```diff
-    <footer id="contact" className="bg-[#0d0d0d] text-white py-16 text-center">
+    <footer id="contact" data-track-label="Contact" className="bg-[#0d0d0d] text-white py-16 text-center">
```

- [ ] **Step 2: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: PASS — 121 tests passed (이 Task는 새 테스트를 추가하지 않으므로 Task 6까지의 누적 수와 동일)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/components/HeroSection.jsx src/components/AboutSection.jsx src/components/StrengthSection.jsx src/components/CareerSection.jsx src/components/AvailableSection.jsx src/components/SnsSection.jsx src/components/ServicesSection.jsx src/components/PersonalitySection.jsx src/components/ContactSection.jsx
git commit -m "feat: 정적 섹션에 data-track-label 속성 추가"
```

---

## Task 8: `CharacterSectionBlock` — 섹션 라벨 + 캐릭터 클릭 추적

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\CharacterSectionBlock.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\__tests__\CharacterSectionBlock.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ session, loading }`, `canTrackVisit`/`getOrCreateVisitorId` (Task 2), `insertEvent` (Task 3)

- [ ] **Step 1: 실패하는 테스트 추가**

`C:\Users\Eric\portfolio-cosplay\src\components\__tests__\CharacterSectionBlock.test.jsx`의 import/mock 블록을 아래와 같이 바꾸고, `describe` 블록 끝에 새 테스트 3개를 추가한다.

```diff
 import { render, screen, fireEvent } from '@testing-library/react'
 import CharacterSectionBlock from '../CharacterSectionBlock'
+import { useAuth } from '../../hooks/useAuth'
+import { canTrackVisit, getOrCreateVisitorId } from '../../lib/analytics'
+import { insertEvent } from '../../lib/tracking'
+
+vi.mock('../../hooks/useAuth', () => ({
+  useAuth: vi.fn(),
+}))
+vi.mock('../../lib/analytics', () => ({
+  canTrackVisit: vi.fn(),
+  getOrCreateVisitorId: vi.fn(),
+}))
+vi.mock('../../lib/tracking', () => ({
+  insertEvent: vi.fn(),
+}))

 const mockSection = {
```

```diff
 describe('CharacterSectionBlock', () => {
+  beforeEach(() => {
+    vi.clearAllMocks()
+    useAuth.mockReturnValue({ session: null, loading: false })
+    canTrackVisit.mockReturnValue(false)
+  })
+
   it('섹션 제목을 표시한다', () => {
```

파일 맨 끝, 마지막 `it(...)` 블록 뒤 `})` 바로 앞에 추가:

```diff
   it('showMoreEnabled가 false면 6개를 넘어도 전부 표시되고 더보기 버튼이 없다', () => {
     const disabledSection = { ...manyItemsSection, showMoreEnabled: false }
     render(<CharacterSectionBlock section={disabledSection} />)
     expect(screen.getAllByTestId('work-card')).toHaveLength(8)
     expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
   })
+
+  it('section에 heading을 data-track-label로 갖는다', () => {
+    const { container } = render(<CharacterSectionBlock section={mockSection} />)
+    expect(container.querySelector('#characters-photo')).toHaveAttribute('data-track-label', '대표 캐릭터 - 사진')
+  })
+
+  it('관리자가 아니면 카드 클릭 시 character_click 이벤트를 기록한다', () => {
+    canTrackVisit.mockReturnValue(true)
+    getOrCreateVisitorId.mockReturnValue('visitor-1')
+    render(<CharacterSectionBlock section={mockSection} />)
+    fireEvent.click(screen.getAllByTestId('work-card')[0])
+
+    expect(insertEvent).toHaveBeenCalledWith({
+      eventType: 'character_click',
+      label: '캐릭터 1',
+      visitorId: 'visitor-1',
+    })
+  })
+
+  it('관리자면 카드를 클릭해도 이벤트를 기록하지 않는다', () => {
+    canTrackVisit.mockReturnValue(false)
+    render(<CharacterSectionBlock section={mockSection} />)
+    fireEvent.click(screen.getAllByTestId('work-card')[0])
+
+    expect(insertEvent).not.toHaveBeenCalled()
+  })
 })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: FAIL — `data-track-label` 속성이 없음, `insertEvent`가 호출되지 않음

- [ ] **Step 3: `CharacterSectionBlock.jsx` 수정**

`C:\Users\Eric\portfolio-cosplay\src\components\CharacterSectionBlock.jsx`를 아래와 같이 수정한다.

```diff
 import { useState } from 'react'
 import WorkCard from './WorkCard'
 import PhotoModal from './PhotoModal'
+import { useAuth } from '../hooks/useAuth'
+import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
+import { insertEvent } from '../lib/tracking'

 const VISIBLE_COUNT = 6

 export default function CharacterSectionBlock({ section }) {
+  const { session, loading } = useAuth()
   const [activeFilter, setActiveFilter] = useState('전체')
   const [selectedWork, setSelectedWork] = useState(null)
   const [expanded, setExpanded] = useState(false)

   const { id, heading, categories, items, showMoreEnabled } = section
   const limitEnabled = showMoreEnabled !== false
   const filtered = activeFilter === '전체'
     ? items
     : items.filter(item => item.category === activeFilter)

   const visible = (limitEnabled && !expanded) ? filtered.slice(0, VISIBLE_COUNT) : filtered

   function handleFilterClick(category) {
     setActiveFilter(category)
     setExpanded(false)
   }

+  function handleSelectWork(work) {
+    setSelectedWork(work)
+    if (canTrackVisit({ pathname: '/', session, loading })) {
+      insertEvent({ eventType: 'character_click', label: work.title, visitorId: getOrCreateVisitorId() })
+    }
+  }
+
   return (
-    <section id={`characters-${id}`} className="py-20 bg-[#f9f9f7]">
+    <section id={`characters-${id}`} data-track-label={heading} className="py-20 bg-[#f9f9f7]">
       <div className="max-w-6xl mx-auto px-6">
         <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
         <div className="flex gap-3 justify-center mb-10 flex-wrap">
           {categories.map(category => (
             <button
               key={category}
               onClick={() => handleFilterClick(category)}
               className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                 activeFilter === category
                   ? 'bg-gray-900 text-white'
                   : 'border border-gray-300 text-gray-600 hover:border-gray-500'
               }`}
             >
               {category}
             </button>
           ))}
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {visible.map(item => (
-            <WorkCard key={item.id} work={item} onClick={setSelectedWork} />
+            <WorkCard key={item.id} work={item} onClick={handleSelectWork} />
           ))}
         </div>
```

`pathname: '/'`을 하드코딩하는 이유: `CharacterSectionBlock`은 구조상 항상 공개 페이지(`/`) 안에서만 렌더링되므로, `useLocation()`으로 라우터 컨텍스트를 요구하지 않아도 된다 — 이 결정 덕분에 이 컴포넌트의 기존 테스트들이 `<MemoryRouter>` 래핑 없이도 계속 통과한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: PASS — 15 tests passed (기존 12개 + 신규 3개)

- [ ] **Step 5: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: PASS — 124 tests passed

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/components/CharacterSectionBlock.jsx src/components/__tests__/CharacterSectionBlock.test.jsx
git commit -m "feat: 캐릭터 섹션에 조회 라벨과 카드 클릭 추적 추가"
```

---

## Task 9: `App.jsx`에 새 훅 연결

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\App.jsx`

**Interfaces:**
- Consumes: `useVisitDuration()` (Task 5), `useSectionViewTracking()` (Task 6)

- [ ] **Step 1: `PageTracker`에 새 훅 호출 추가**

`C:\Users\Eric\portfolio-cosplay\src\App.jsx`를 아래와 같이 수정한다.

```diff
 import { usePageTracking } from './hooks/usePageTracking'
+import { useSectionViewTracking } from './hooks/useSectionViewTracking'
+import { useVisitDuration } from './hooks/useVisitDuration'

 function PageTracker() {
   usePageTracking()
+  useSectionViewTracking()
+  useVisitDuration()
   return null
 }
```

- [ ] **Step 2: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: PASS — 124 tests passed (이 프로젝트에는 `App.jsx` 자체를 렌더링하는 테스트가 없으므로 신규 실패가 없어야 한다)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/App.jsx
git commit -m "feat: 공개 페이지에 체류시간·섹션조회 추적 연결"
```

---

## Task 10: `VisitorAnalytics` 대시보드에 참여도 지표 표시

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\admin\sections\VisitorAnalytics.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\__tests__\VisitorAnalytics.test.jsx`

**Interfaces:**
- Consumes: `averageDuration`, `formatDuration`, `sectionViewCounts`, `topCharacterClicks` (Task 2), `supabase.from('page_events').select(...)` (같은 `.gte()`/thenable 패턴을 `page_views`와 동일하게 따름)

- [ ] **Step 1: 테스트를 새 구조에 맞게 다시 작성**

`C:\Users\Eric\portfolio-cosplay\src\components\__tests__\VisitorAnalytics.test.jsx` 파일 전체를 아래 내용으로 교체한다. (기존엔 `page_views` 하나만 조회했지만, 이제 `page_events`도 같은 기간으로 병렬 조회하므로 mock을 두 테이블용으로 확장한다.)

```jsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import VisitorAnalytics from '../admin/sections/VisitorAnalytics'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

const viewRows = [
  { created_at: '2026-08-01T01:00:00.000Z', referrer: 'https://instagram.com/x', visitor_id: 'a' },
  { created_at: '2026-08-01T02:00:00.000Z', referrer: 'https://instagram.com/y', visitor_id: 'b' },
  { created_at: '2026-08-02T01:00:00.000Z', referrer: null, visitor_id: 'a' },
]

const eventRows = [
  { event_type: 'duration', label: null, value: 100 },
  { event_type: 'duration', label: null, value: 200 },
  { event_type: 'section_view', label: 'Hero', value: null },
  { event_type: 'section_view', label: 'Hero', value: null },
  { event_type: 'section_view', label: 'Contact', value: null },
  { event_type: 'character_click', label: '캐릭터A', value: null },
  { event_type: 'character_click', label: '캐릭터A', value: null },
  { event_type: 'character_click', label: '캐릭터B', value: null },
]

// 실제 supabase-js 쿼리 빌더는 .gte()를 체이닝하지 않고 바로 await해도 동작하고,
// .gte()를 체이닝한 뒤에도 동일하게 동작한다(둘 다 thenable) — 이 목으로 두 경로를 모두 재현한다.
function makeQueryBuilder(result) {
  return {
    gte: vi.fn(() => makeQueryBuilder(result)),
    then: (resolve) => resolve(result),
  }
}

function mockFrom({ pageViews, pageEvents }) {
  const selectViews = vi.fn().mockReturnValue(makeQueryBuilder(pageViews))
  const selectEvents = vi.fn().mockReturnValue(makeQueryBuilder(pageEvents))
  supabase.from.mockImplementation(table => {
    if (table === 'page_views') return { select: selectViews }
    if (table === 'page_events') return { select: selectEvents }
    throw new Error(`unexpected table: ${table}`)
  })
  return { selectViews, selectEvents }
}

describe('VisitorAnalytics', () => {
  it('로딩 후 총 방문 수, 순 방문자 수, 평균 체류 시간을 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('순 방문자 수').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('평균 체류 시간').nextElementSibling).toHaveTextContent('2분 30초')
  })

  it('유입 경로를 방문 횟수 내림차순으로 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('유입 경로 Top 5')
    const list = screen.getByText('유입 경로 Top 5').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('instagram.com')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('직접 방문')
  })

  it('섹션별 조회수를 내림차순으로 전체 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('섹션별 조회수')
    const list = screen.getByText('섹션별 조회수').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Hero')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('Contact')
  })

  it('인기 캐릭터를 클릭 수 내림차순 상위 5개까지 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('인기 캐릭터 Top 5')
    const list = screen.getByText('인기 캐릭터 Top 5').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('캐릭터A')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('캐릭터B')
  })

  it('참여도 이벤트가 없으면 평균 체류 시간은 -, 섹션/캐릭터 목록은 데이터 없음을 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: [], error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    expect(screen.getByText('평균 체류 시간').nextElementSibling).toHaveTextContent('-')
    expect(screen.getAllByText('데이터가 없습니다.')).toHaveLength(2)
  })

  it('"전체" 기간을 클릭하면 page_views/page_events 모두 gte 없이 재조회한다', async () => {
    const { selectViews, selectEvents } = mockFrom({
      pageViews: { data: viewRows, error: null },
      pageEvents: { data: eventRows, error: null },
    })
    render(<VisitorAnalytics />)
    await screen.findByText('총 방문 수')

    fireEvent.click(screen.getByRole('button', { name: '전체' }))

    await waitFor(() => expect(selectViews).toHaveBeenCalledTimes(2))
    expect(selectEvents).toHaveBeenCalledTimes(2)
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const { selectViews } = mockFrom({
      pageViews: { data: null, error: { message: '권한 없음' } },
      pageEvents: { data: eventRows, error: null },
    })
    render(<VisitorAnalytics />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(selectViews).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(selectViews).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/VisitorAnalytics.test.jsx`
Expected: FAIL — `page_events` 조회가 없어 "평균 체류 시간"/"섹션별 조회수"/"인기 캐릭터 Top 5" 텍스트를 찾지 못함

- [ ] **Step 3: `VisitorAnalytics.jsx` 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\components\admin\sections\VisitorAnalytics.jsx` 파일 전체를 아래 내용으로 교체한다.

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  groupByDate,
  topReferrers,
  countUniqueVisitors,
  averageDuration,
  formatDuration,
  sectionViewCounts,
  topCharacterClicks,
} from '../../../lib/analytics'

const RANGES = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'all', label: '전체', days: null },
]

export default function VisitorAnalytics() {
  const [rangeKey, setRangeKey] = useState('7d')
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ rows: null, eventRows: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: null, eventRows: null, loading: true, error: null })

    async function fetchAll() {
      const range = RANGES.find(r => r.key === rangeKey)
      const since = range.days !== null
        ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
        : null

      function withRange(query) {
        return since !== null ? query.gte('created_at', since) : query
      }

      const [viewsResult, eventsResult] = await Promise.all([
        withRange(supabase.from('page_views').select('created_at, referrer, visitor_id')),
        withRange(supabase.from('page_events').select('event_type, label, value')),
      ])

      if (cancelled) return

      const error = viewsResult.error ?? eventsResult.error
      if (error) {
        setState({ rows: null, eventRows: null, loading: false, error })
        return
      }
      setState({ rows: viewsResult.data, eventRows: eventsResult.data, loading: false, error: null })
    }

    fetchAll()

    return () => { cancelled = true }
  }, [rangeKey, reloadToken])

  if (state.loading) {
    return <p className="text-gray-500 text-sm">불러오는 중...</p>
  }

  if (state.error) {
    return (
      <div className="text-sm text-red-500">
        데이터를 불러오지 못했습니다.
        <button
          type="button"
          onClick={() => setReloadToken(t => t + 1)}
          className="ml-2 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const rows = state.rows
  const eventRows = state.eventRows
  const daily = groupByDate(rows)
  const referrers = topReferrers(rows)
  const maxCount = Math.max(1, ...daily.map(d => d.count))

  const durationRows = eventRows.filter(e => e.event_type === 'duration')
  const sectionRows = eventRows.filter(e => e.event_type === 'section_view')
  const characterRows = eventRows.filter(e => e.event_type === 'character_click')
  const avgDuration = averageDuration(durationRows)
  const sectionCounts = sectionViewCounts(sectionRows)
  const topCharacters = topCharacterClicks(characterRows)

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1 rounded text-sm ${
              rangeKey === r.key ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 방문 수</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">순 방문자 수</p>
          <p className="text-2xl font-bold">{countUniqueVisitors(rows)}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">평균 체류 시간</p>
          <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">일별 방문 추이</h3>
      {daily.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {daily.length > 0 && (
        <div className="flex items-stretch gap-1 h-32 mb-8">
          {daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-gray-900 rounded-t"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
                title={`${d.date}: ${d.count}`}
              />
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">유입 경로 Top 5</h3>
      {referrers.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {referrers.length > 0 && (
        <ul className="space-y-1 mb-8">
          {referrers.map(r => (
            <li key={r.domain} className="flex justify-between text-sm border-b py-1">
              <span>{r.domain}</span>
              <span className="text-gray-500">{r.count}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">섹션별 조회수</h3>
      {sectionCounts.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {sectionCounts.length > 0 && (
        <ul className="space-y-1 mb-8">
          {sectionCounts.map(s => (
            <li key={s.label} className="flex justify-between text-sm border-b py-1">
              <span>{s.label}</span>
              <span className="text-gray-500">{s.count}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">인기 캐릭터 Top 5</h3>
      {topCharacters.length === 0 && <p className="text-sm text-gray-400">데이터가 없습니다.</p>}
      {topCharacters.length > 0 && (
        <ul className="space-y-1">
          {topCharacters.map(c => (
            <li key={c.label} className="flex justify-between text-sm border-b py-1">
              <span>{c.label}</span>
              <span className="text-gray-500">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/VisitorAnalytics.test.jsx`
Expected: PASS — 7 tests passed

- [ ] **Step 5: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: PASS — 127 tests passed

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/components/admin/sections/VisitorAnalytics.jsx src/components/__tests__/VisitorAnalytics.test.jsx
git commit -m "feat: 방문자 분석 대시보드에 체류시간/섹션조회/인기캐릭터 표시"
```

---

## Task 11: Supabase 적용 · 배포 · 검증 · 문서화

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`

**Interfaces:**
- Consumes: Task 1의 `supabase/update-page-events.sql`, Task 1~10에서 완성된 전체 기능

- [ ] **Step 1: Supabase 대시보드에 마이그레이션 적용**

Supabase 프로젝트 대시보드(SQL Editor)에서 `supabase/update-page-events.sql`의 전체 내용을 붙여넣고 실행한다.

**주의**: 브라우저 자동화로 SQL을 입력할 경우, 이전 작업(`page_views` 마이그레이션)에서 Monaco 에디터의 자동완성이 `authenticated` 뒤에 줄바꿈을 넣는 순간 `authentication_method`로 잘못 치환한 적이 있다 — `"page_events anon insert"` 정책의 `to anon, authenticated` 및 `"page_events authenticated read"` 정책의 `to authenticated` 부분을 실행 전 스크린샷으로 반드시 육안 확인한다.

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY` x2가 각각 에러 없이 성공.

- [ ] **Step 2: RLS 정책 검증 (SQL Editor)**

```sql
-- anon 롤이 insert할 수 있는지 확인
set role anon;
insert into page_events (event_type, label, value, visitor_id)
values ('section_view', 'Hero', null, gen_random_uuid());
reset role;

select count(*) from page_events;
```

Expected: `insert` 성공, `count`가 1 이상.

```sql
-- anon 롤이 select할 수 없는지 확인
set role anon;
select * from page_events;
reset role;
```

Expected: 빈 결과 (RLS로 인해 행이 보이지 않음 — 에러가 아니라 0 rows).

```sql
-- event_type check 제약이 걸려있는지 확인 (실패해야 정상)
insert into page_events (event_type, visitor_id) values ('invalid_type', gen_random_uuid());
```

Expected: `new row for relation "page_events" violates check constraint` 에러.

```sql
-- 방금 넣은 테스트 데이터 정리
delete from page_events where label = 'Hero' and event_type = 'section_view';
```

- [ ] **Step 3: 프로덕션 빌드 및 배포**

```bash
cd /c/Users/Eric/portfolio-cosplay
npm run build
npx vercel --prod --yes
```

Expected: 빌드 성공, `https://cos-profile.vercel.app`에 배포 완료 메시지.

- [ ] **Step 4: 실제 배포 사이트에서 동작 확인**

1. 새 시크릿창(또는 완전히 새로운 비로그인 브라우저 컨텍스트)으로 `https://cos-profile.vercel.app`에 접속해, 페이지를 Hero부터 Contact까지 천천히 끝까지 스크롤한 뒤, 탭을 닫거나 다른 탭으로 전환한다.
2. Supabase 대시보드 → Table Editor → `page_events`에서 `section_view` 이벤트가 여러 섹션 라벨로, `duration` 이벤트가 1건 기록됐는지 확인한다.
3. 같은 방문에서 대표 캐릭터 카드를 하나 클릭해 모달을 열어본 뒤, `page_events`에 `character_click` 이벤트가 해당 캐릭터 제목으로 기록됐는지 확인한다.
4. `/admin`에 로그인한 뒤 "방문자 분석" 메뉴에서 평균 체류 시간·섹션별 조회수·인기 캐릭터 Top 5가 방금 만든 데이터를 반영해 표시되는지 확인한다.
5. 관리자 상태(같은 브라우저의 로그인된 탭)에서 공개 페이지(`/`)를 새로고침하고 스크롤·카드 클릭을 해봐도 `page_events`에 새 행이 **추가되지 않는지** 확인한다.

- [ ] **Step 5: 작업 이력 문서화**

`C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`을 열어 `## 배포` 섹션 바로 위에 아래 항목을 추가한다.

```markdown
## 2026-08-03 — 방문자 참여도 지표 (체류시간·섹션조회·캐릭터클릭)

- `page_events` 테이블 추가 — `duration`/`section_view`/`character_click` 세 종류 이벤트를 익명(`anon`) insert, 조회는 `authenticated`만 가능
- `canTrackVisit`/`insertPageView`/`insertEvent` 공용 헬퍼로 정리, 기존 `usePageTracking`도 동일 헬퍼를 쓰도록 리팩터링
- `useVisitDuration`: 탭이 백그라운드로 가거나 닫힐 때(`visibilitychange`) 체류 시간을 `fetch(keepalive:true)`로 기록
- `useSectionViewTracking`: 모든 공개 섹션에 `data-track-label`을 부여하고 `IntersectionObserver`+`MutationObserver`로 방문당 섹션별 1회 조회 기록
- 캐릭터 카드 클릭 시 `character_click` 이벤트 기록
- `/admin` "방문자 분석"에 평균 체류 시간, 섹션별 조회수(전체), 인기 캐릭터 Top 5 추가
- 설계: `docs/superpowers/specs/2026-08-03-visitor-engagement-metrics-design.md`

```

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add docs/UPDATE_HISTORY.md
git commit -m "docs: 방문자 참여도 지표 기능 적용 및 검증 완료 기록"
```
