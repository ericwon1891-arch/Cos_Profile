# 방문자 분석 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 페이지 방문을 Supabase `page_views` 테이블에 익명 기록하고, `/admin` 대시보드에 "방문자 분석" 탭을 추가해 총 방문/순 방문자/일별 추이/유입 경로(레퍼러) Top 5를 보여준다.

**Architecture:** 공개 페이지 최상단(`App.jsx`)에 위치한 `PageTracker` 컴포넌트가 `usePageTracking` 훅으로 라우트 변경마다 `page_views`에 insert한다. 관리자 세션이거나 `/admin` 경로면 기록하지 않는다. 레퍼러 도메인 파싱·날짜별 그룹핑·순 방문자 집계는 `src/lib/analytics.js`의 순수 함수로 분리해 `VisitorAnalytics.jsx`(신규 관리자 섹션)와 훅 양쪽에서 재사용한다.

**Tech Stack:** React 19 + react-router-dom(useLocation) + Supabase(Postgres/RLS) — 신규 npm 의존성 없음, 차트는 CSS 막대로 직접 구현.

## Global Constraints

- `page_views` RLS: `insert`는 `anon`+`authenticated` 모두 허용, `select`는 `authenticated`만 허용, `update`/`delete` 정책은 만들지 않는다 (참조: `docs/superpowers/specs/2026-08-02-visitor-analytics-design.md`)
- 관리자 로그인 세션 또는 `/admin`으로 시작하는 경로는 절대 추적하지 않는다
- "인기 경로" 등 콘텐츠/섹션 단위 분석은 범위 밖 — 공개 사이트가 `/` 단일 경로 SPA이기 때문
- 신규 차트 라이브러리를 추가하지 않는다 — 일별 추이는 CSS `div` 높이 기반 막대로 구현
- Supabase 클라이언트는 모든 테스트에서 `vi.mock`으로 대체한다 — 실제 네트워크 호출 금지 (기존 `useSectionContent.test.js`, `useAuth.test.js` 패턴을 따른다)
- 컴포넌트 테스트 파일은 소스 위치와 무관하게 `src/components/__tests__/`에 평평하게 둔다 (기존 `AccountForm.test.jsx` 등과 동일 컨벤션)

---

## Task 1: DB 마이그레이션 파일 작성

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\supabase\update-page-views.sql`

**Interfaces:**
- Produces: `page_views` 테이블(`id`, `path`, `referrer`, `visitor_id`, `created_at`) — Task 7에서 Supabase 프로젝트에 실제 적용한다. 이후 Task 3(`usePageTracking`)의 insert, Task 5(`VisitorAnalytics`)의 select가 이 스키마를 그대로 사용한다.

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

`C:\Users\Eric\portfolio-cosplay\supabase\update-page-views.sql` 파일을 아래 내용으로 새로 만든다.

```sql
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
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add supabase/update-page-views.sql
git commit -m "feat: page_views 테이블 마이그레이션 추가"
```

---

## Task 2: 분석 순수 함수 (`src/lib/analytics.js`)

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\lib\analytics.js`
- Test: `C:\Users\Eric\portfolio-cosplay\src\lib\analytics.test.js`

**Interfaces:**
- Produces:
  - `getOrCreateVisitorId(): string` — `localStorage`에 `cosplay_visitor_id` 키로 UUID를 저장/재사용
  - `getReferrerDomain(referrer: string|null, currentHostname?: string): string` — `referrer`가 없거나 파싱 실패, 또는 `currentHostname`과 같으면 `'직접 방문'`, 아니면 `hostname`
  - `groupByDate(rows: {created_at: string}[]): {date: string, count: number}[]` — 날짜(`YYYY-MM-DD`) 오름차순
  - `topReferrers(rows: {referrer: string|null}[], limit?: number): {domain: string, count: number}[]` — 방문 횟수 내림차순 상위 N개 (기본 5)
  - `countUniqueVisitors(rows: {visitor_id: string}[]): number`
- Consumed by: Task 3(`usePageTracking`)의 `getOrCreateVisitorId`, Task 5(`VisitorAnalytics`)의 나머지 4개 함수

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\analytics.test.js` 파일을 아래 내용으로 새로 만든다.

```js
import { getOrCreateVisitorId, getReferrerDomain, groupByDate, topReferrers, countUniqueVisitors } from './analytics'

describe('getOrCreateVisitorId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('처음 호출 시 UUID를 생성해 localStorage에 저장한다', () => {
    const id = getOrCreateVisitorId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('cosplay_visitor_id')).toBe(id)
  })

  it('이미 저장된 값이 있으면 재사용한다', () => {
    localStorage.setItem('cosplay_visitor_id', 'existing-id')
    expect(getOrCreateVisitorId()).toBe('existing-id')
  })
})

describe('getReferrerDomain', () => {
  it('referrer가 없으면 직접 방문을 반환한다', () => {
    expect(getReferrerDomain(null, 'cos-profile.vercel.app')).toBe('직접 방문')
    expect(getReferrerDomain('', 'cos-profile.vercel.app')).toBe('직접 방문')
  })

  it('같은 도메인에서 온 referrer는 직접 방문으로 취급한다', () => {
    expect(getReferrerDomain('https://cos-profile.vercel.app/admin', 'cos-profile.vercel.app')).toBe('직접 방문')
  })

  it('외부 도메인은 hostname을 반환한다', () => {
    expect(getReferrerDomain('https://www.instagram.com/x', 'cos-profile.vercel.app')).toBe('www.instagram.com')
  })

  it('잘못된 URL 형식이면 직접 방문을 반환한다', () => {
    expect(getReferrerDomain('not-a-url', 'cos-profile.vercel.app')).toBe('직접 방문')
  })
})

describe('groupByDate', () => {
  it('날짜별로 개수를 세고 오름차순 정렬한다', () => {
    const rows = [
      { created_at: '2026-08-02T01:00:00.000Z' },
      { created_at: '2026-08-01T23:00:00.000Z' },
      { created_at: '2026-08-02T10:00:00.000Z' },
    ]
    expect(groupByDate(rows)).toEqual([
      { date: '2026-08-01', count: 1 },
      { date: '2026-08-02', count: 2 },
    ])
  })
})

describe('topReferrers', () => {
  it('방문 횟수 내림차순으로 상위 N개를 반환한다', () => {
    const rows = [
      { referrer: 'https://instagram.com/x' },
      { referrer: 'https://instagram.com/y' },
      { referrer: 'https://google.com/search' },
      { referrer: null },
    ]
    expect(topReferrers(rows, 2)).toEqual([
      { domain: 'instagram.com', count: 2 },
      { domain: 'google.com', count: 1 },
    ])
  })
})

describe('countUniqueVisitors', () => {
  it('distinct visitor_id 개수를 센다', () => {
    const rows = [{ visitor_id: 'a' }, { visitor_id: 'b' }, { visitor_id: 'a' }]
    expect(countUniqueVisitors(rows)).toBe(2)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/analytics.test.js`
Expected: FAIL — `Failed to resolve import "./analytics"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\lib\analytics.js` 파일을 아래 내용으로 새로 만든다.

```js
const VISITOR_ID_KEY = 'cosplay_visitor_id'

export function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

export function getReferrerDomain(referrer, currentHostname = window.location.hostname) {
  if (!referrer) return '직접 방문'
  try {
    const { hostname } = new URL(referrer)
    return hostname === currentHostname ? '직접 방문' : hostname
  } catch {
    return '직접 방문'
  }
}

export function groupByDate(rows) {
  const counts = {}
  for (const row of rows) {
    const date = row.created_at.slice(0, 10)
    counts[date] = (counts[date] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

export function topReferrers(rows, limit = 5) {
  const counts = {}
  for (const row of rows) {
    const domain = getReferrerDomain(row.referrer)
    counts[domain] = (counts[domain] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }))
}

export function countUniqueVisitors(rows) {
  return new Set(rows.map(row => row.visitor_id)).size
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/lib/analytics.test.js`
Expected: PASS — 9 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/lib/analytics.js src/lib/analytics.test.js
git commit -m "feat: 방문자 분석 집계 순수 함수 추가"
```

---

## Task 3: 페이지뷰 추적 훅 (`usePageTracking`)

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.js`
- Test: `C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.test.js`

**Interfaces:**
- Consumes: `useAuth()` → `{ session, loading }` (기존 `src/hooks/useAuth.js`), `getOrCreateVisitorId()` (Task 2)
- Produces: `usePageTracking(): void` — 부수효과만 있는 훅, Task 4에서 `App.jsx`의 `PageTracker` 컴포넌트가 호출한다

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.test.js` 파일을 아래 내용으로 새로 만든다.

```js
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { usePageTracking } from './usePageTracking'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabaseClient'
import * as analytics from '../lib/analytics'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))
vi.mock('../lib/analytics', () => ({
  getOrCreateVisitorId: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  }
}

describe('usePageTracking', () => {
  let insert

  beforeEach(() => {
    insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })
    analytics.getOrCreateVisitorId.mockReturnValue('visitor-123')
  })

  it('로그인하지 않은 방문자가 공개 페이지에 접근하면 page_views에 기록한다', async () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('page_views'))
    expect(insert).toHaveBeenCalledWith({ path: '/', referrer: null, visitor_id: 'visitor-123' })
  })

  it('관리자 세션이 있으면 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('/admin 경로에서는 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/admin') })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('auth 로딩 중에는 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: null, loading: true })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(supabase.from).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/usePageTracking.test.js`
Expected: FAIL — `Failed to resolve import "./usePageTracking"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\hooks\usePageTracking.js` 파일을 아래 내용으로 새로 만든다.

```js
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'
import { getOrCreateVisitorId } from '../lib/analytics'

export function usePageTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (session) return
    if (location.pathname.startsWith('/admin')) return

    supabase
      .from('page_views')
      .insert({
        path: location.pathname,
        referrer: document.referrer || null,
        visitor_id: getOrCreateVisitorId(),
      })
      .then(({ error }) => {
        if (error) console.error('페이지뷰 기록 실패', error)
      })
  }, [location.pathname, session, loading])
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/hooks/usePageTracking.test.js`
Expected: PASS — 4 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/hooks/usePageTracking.js src/hooks/usePageTracking.test.js
git commit -m "feat: 페이지뷰 추적 훅(usePageTracking) 추가"
```

---

## Task 4: `App.jsx`에 트래킹 연결

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\App.jsx`

**Interfaces:**
- Consumes: `usePageTracking()` (Task 3)

- [ ] **Step 1: `PageTracker` 컴포넌트 추가 및 연결**

`C:\Users\Eric\portfolio-cosplay\src\App.jsx`를 아래와 같이 수정한다.

```diff
 import { BrowserRouter, Routes, Route } from 'react-router-dom'
 import Navbar from './components/Navbar'
 import HeroSection from './components/HeroSection'
 import AboutSection from './components/AboutSection'
 import StrengthSection from './components/StrengthSection'
 import CareerSection from './components/CareerSection'
 import CharactersSection from './components/CharactersSection'
 import AvailableSection from './components/AvailableSection'
 import SnsSection from './components/SnsSection'
 import ServicesSection from './components/ServicesSection'
 import PersonalitySection from './components/PersonalitySection'
 import ContactSection from './components/ContactSection'
 import AdminLogin from './components/admin/AdminLogin'
 import AdminDashboard from './components/admin/AdminDashboard'
 import RequireAuth from './components/admin/RequireAuth'
+import { usePageTracking } from './hooks/usePageTracking'
+
+function PageTracker() {
+  usePageTracking()
+  return null
+}

 function PublicSite() {
   return (
     <>
       <Navbar />
       <HeroSection />
       <AboutSection />
       <StrengthSection />
       <CareerSection />
       <CharactersSection />
       <AvailableSection />
       <SnsSection />
       <ServicesSection />
       <PersonalitySection />
       <ContactSection />
     </>
   )
 }

 export default function App() {
   return (
     <BrowserRouter>
+      <PageTracker />
       <Routes>
         <Route path="/" element={<PublicSite />} />
         <Route path="/admin/login" element={<AdminLogin />} />
         <Route
           path="/admin"
           element={
             <RequireAuth>
               <AdminDashboard />
             </RequireAuth>
           }
         />
       </Routes>
     </BrowserRouter>
   )
 }
```

`PageTracker`는 `BrowserRouter` 내부, `Routes`와 형제로 둔다 — `useLocation()`이 라우터 컨텍스트를 필요로 하고, `Routes`가 매치하는 라우트와 무관하게 경로 변경마다 리렌더되어야 하기 때문이다.

- [ ] **Step 2: 전체 테스트 스위트 실행해 회귀가 없는지 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: 기존 테스트 전부 PASS (이 프로젝트에는 `App.jsx` 자체를 렌더링하는 테스트가 없으므로 신규 실패가 없어야 한다)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/App.jsx
git commit -m "feat: 공개 페이지에 방문자 트래킹 연결"
```

---

## Task 5: 관리자 대시보드 "방문자 분석" 컴포넌트

**Files:**
- Create: `C:\Users\Eric\portfolio-cosplay\src\components\admin\sections\VisitorAnalytics.jsx`
- Test: `C:\Users\Eric\portfolio-cosplay\src\components\__tests__\VisitorAnalytics.test.jsx`

**Interfaces:**
- Consumes: `supabase.from('page_views').select(...)` (선택적으로 `.gte(...)` 체이닝), `groupByDate`/`topReferrers`/`countUniqueVisitors` (Task 2)
- Produces: `VisitorAnalytics` 기본 export 컴포넌트, props 없음 — Task 6에서 `AdminDashboard`가 렌더링한다

- [ ] **Step 1: 실패하는 테스트 작성**

`C:\Users\Eric\portfolio-cosplay\src\components\__tests__\VisitorAnalytics.test.jsx` 파일을 아래 내용으로 새로 만든다.

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VisitorAnalytics from '../admin/sections/VisitorAnalytics'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

const rows = [
  { created_at: '2026-08-01T01:00:00.000Z', referrer: 'https://instagram.com/x', visitor_id: 'a' },
  { created_at: '2026-08-01T02:00:00.000Z', referrer: 'https://instagram.com/y', visitor_id: 'b' },
  { created_at: '2026-08-02T01:00:00.000Z', referrer: null, visitor_id: 'a' },
]

// 실제 supabase-js 쿼리 빌더는 .gte()를 체이닝하지 않고 바로 await해도 동작하고,
// .gte()를 체이닝한 뒤에도 동일하게 동작한다(둘 다 thenable) — 이 목으로 두 경로를 모두 재현한다.
function makeQueryBuilder(result) {
  return {
    gte: vi.fn(() => makeQueryBuilder(result)),
    then: (resolve) => resolve(result),
  }
}

function mockSelect(result) {
  const select = vi.fn().mockReturnValue(makeQueryBuilder(result))
  supabase.from.mockReturnValue({ select })
  return { select }
}

describe('VisitorAnalytics', () => {
  it('로딩 후 총 방문 수와 순 방문자 수를 표시한다', async () => {
    mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    // '3'/'2' 같은 숫자만으로 getByText를 쓰면 유입 경로 목록의 카운트(예: instagram.com 옆의 '2')와
    // 같은 텍스트가 겹쳐 여러 엘리먼트가 매치될 수 있으므로, 라벨의 다음 형제 엘리먼트를 지정해 조회한다.
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('순 방문자 수').nextElementSibling).toHaveTextContent('2')
  })

  it('유입 경로를 방문 횟수 내림차순으로 표시한다', async () => {
    mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)

    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('instagram.com')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('직접 방문')
  })

  it('"전체" 기간을 클릭하면 gte 없이 조회하고 결과를 다시 표시한다', async () => {
    const { select } = mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)
    await screen.findByText('총 방문 수')

    fireEvent.click(screen.getByRole('button', { name: '전체' }))

    await waitFor(() => expect(select).toHaveBeenCalledTimes(2))
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const { select } = mockSelect({ data: null, error: { message: '권한 없음' } })
    render(<VisitorAnalytics />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(select).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(select).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/VisitorAnalytics.test.jsx`
Expected: FAIL — `Failed to resolve import "../admin/sections/VisitorAnalytics"` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`C:\Users\Eric\portfolio-cosplay\src\components\admin\sections\VisitorAnalytics.jsx` 파일을 아래 내용으로 새로 만든다.

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { groupByDate, topReferrers, countUniqueVisitors } from '../../../lib/analytics'

const RANGES = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'all', label: '전체', days: null },
]

export default function VisitorAnalytics() {
  const [rangeKey, setRangeKey] = useState('7d')
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ rows: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: null, loading: true, error: null })

    async function fetchRows() {
      const range = RANGES.find(r => r.key === rangeKey)
      let query = supabase.from('page_views').select('created_at, referrer, visitor_id')
      if (range.days !== null) {
        const since = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', since)
      }
      const { data, error } = await query
      if (cancelled) return
      setState({ rows: error ? null : data, loading: false, error: error ?? null })
    }

    fetchRows()

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
  const daily = groupByDate(rows)
  const referrers = topReferrers(rows)
  const maxCount = Math.max(1, ...daily.map(d => d.count))

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

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 방문 수</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">순 방문자 수</p>
          <p className="text-2xl font-bold">{countUniqueVisitors(rows)}</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">일별 방문 추이</h3>
      {daily.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {daily.length > 0 && (
        <div className="flex items-end gap-1 h-32 mb-8">
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
      {referrers.length === 0 && <p className="text-sm text-gray-400">데이터가 없습니다.</p>}
      {referrers.length > 0 && (
        <ul className="space-y-1">
          {referrers.map(r => (
            <li key={r.domain} className="flex justify-between text-sm border-b py-1">
              <span>{r.domain}</span>
              <span className="text-gray-500">{r.count}</span>
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
Expected: PASS — 4 tests passed

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/components/admin/sections/VisitorAnalytics.jsx src/components/__tests__/VisitorAnalytics.test.jsx
git commit -m "feat: 관리자 대시보드에 방문자 분석 컴포넌트 추가"
```

---

## Task 6: `AdminDashboard`에 "방문자 분석" 메뉴 연결

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\admin\AdminDashboard.jsx`
- Modify: `C:\Users\Eric\portfolio-cosplay\src\components\__tests__\AdminDashboard.test.jsx`

**Interfaces:**
- Consumes: `VisitorAnalytics` (Task 5)

- [ ] **Step 1: 실패하는 테스트 추가**

`C:\Users\Eric\portfolio-cosplay\src\components\__tests__\AdminDashboard.test.jsx`의 `vi.mock` 블록 아래에 `VisitorAnalytics` mock을 추가하고, `describe('AdminDashboard', ...)` 안 마지막 `it`(계정 설정 테스트) 뒤에 새 테스트를 추가한다.

```diff
 vi.mock('../../lib/supabaseClient', () => ({
   supabase: {
     from: vi.fn(),
     storage: { from: vi.fn() },
   },
 }))
+vi.mock('../admin/sections/VisitorAnalytics', () => ({
+  default: () => <div>방문자 분석 화면</div>,
+}))
```

```diff
   it('계정 설정 메뉴를 클릭하면 비밀번호 변경 폼을 보여준다', () => {
     render(<AdminDashboard />)
     fireEvent.click(screen.getByRole('button', { name: '계정 설정' }))

     expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
     expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
     expect(useSectionContent).toHaveBeenCalledWith(null)
   })
+
+  it('방문자 분석 메뉴를 클릭하면 VisitorAnalytics를 보여준다', () => {
+    render(<AdminDashboard />)
+    fireEvent.click(screen.getByRole('button', { name: '방문자 분석' }))
+
+    expect(screen.getByText('방문자 분석 화면')).toBeInTheDocument()
+    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
+    expect(useSectionContent).toHaveBeenCalledWith(null)
+  })
 })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npx vitest run src/components/__tests__/AdminDashboard.test.jsx`
Expected: FAIL — `방문자 분석` 버튼을 찾을 수 없음 (`Unable to find an accessible element with the role "button" and name "방문자 분석"`)

- [ ] **Step 3: `AdminDashboard.jsx` 수정**

`C:\Users\Eric\portfolio-cosplay\src\components\admin\AdminDashboard.jsx`를 아래와 같이 수정한다.

```diff
 import ServicesForm from './sections/ServicesForm'
 import PersonalityForm from './sections/PersonalityForm'
 import ContactForm from './sections/ContactForm'
 import AccountForm from './sections/AccountForm'
+import VisitorAnalytics from './sections/VisitorAnalytics'

 const SECTIONS = [
   { key: 'hero', label: 'Hero', Form: HeroForm },
   { key: 'about', label: 'About Me', Form: AboutForm },
   { key: 'strength', label: 'Strength', Form: StrengthForm },
   { key: 'career', label: 'Career', Form: CareerForm },
   { key: 'characters', label: '대표 캐릭터', Form: CharactersForm },
   { key: 'available', label: 'Available', Form: AvailableForm },
   { key: 'sns', label: 'SNS', Form: SnsForm },
   { key: 'services', label: 'Additional Services', Form: ServicesForm },
   { key: 'personality', label: 'Personality', Form: PersonalityForm },
   { key: 'contact', label: 'Contact', Form: ContactForm },
+  { key: 'analytics', label: '방문자 분석' },
   { key: 'account', label: '계정 설정' },
 ]

+const NO_CONTENT_KEYS = ['account', 'analytics']
+
 export default function AdminDashboard() {
   const { signOut } = useAuth()
   const [activeKey, setActiveKey] = useState(SECTIONS[0].key)
-  const { data, loading } = useSectionContent(activeKey === 'account' ? null : activeKey)
+  const { data, loading } = useSectionContent(NO_CONTENT_KEYS.includes(activeKey) ? null : activeKey)
   const [status, setStatus] = useState(null)
```

```diff
         <main className="flex-1 p-8 max-w-2xl">
           {activeKey === 'account' && <AccountForm />}
-          {activeKey !== 'account' && !loading && data && active && (
+          {activeKey === 'analytics' && <VisitorAnalytics />}
+          {!NO_CONTENT_KEYS.includes(activeKey) && !loading && data && active && (
             <active.Form data={data} onSave={handleSave} />
           )}
-          {activeKey !== 'account' && !loading && !data && (
+          {!NO_CONTENT_KEYS.includes(activeKey) && !loading && !data && (
             <p className="text-gray-500 text-sm">이 섹션의 데이터가 없습니다. supabase/seed.sql을 실행했는지 확인해 주세요.</p>
           )}
         </main>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /c/Users/Eric/portfolio-cosplay && npm test -- --run`
Expected: 전체 테스트 PASS (기존 테스트 포함 회귀 없음)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add src/components/admin/AdminDashboard.jsx src/components/__tests__/AdminDashboard.test.jsx
git commit -m "feat: 관리자 대시보드에 방문자 분석 메뉴 연결"
```

---

## Task 7: Supabase 적용 · 배포 · 검증 · 문서화

**Files:**
- Modify: `C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`

**Interfaces:**
- Consumes: Task 1의 `supabase/update-page-views.sql`, Task 1~6에서 완성된 전체 기능

- [ ] **Step 1: Supabase 대시보드에 마이그레이션 적용**

Supabase 프로젝트 대시보드 → SQL Editor에서 `supabase/update-page-views.sql`의 전체 내용을 붙여넣고 실행한다.

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY` x2가 각각 에러 없이 성공.

- [ ] **Step 2: RLS 정책 검증 (SQL Editor)**

```sql
-- anon 롤이 insert할 수 있는지 확인
set role anon;
insert into page_views (path, referrer, visitor_id)
values ('/', null, gen_random_uuid());
reset role;

select count(*) from page_views;
```

Expected: `insert` 성공, `count`가 1 이상.

```sql
-- anon 롤이 select할 수 없는지 확인
set role anon;
select * from page_views;
reset role;
```

Expected: 빈 결과 (RLS로 인해 행이 보이지 않음 — 에러가 아니라 0 rows).

```sql
-- 방금 넣은 테스트 데이터 정리
delete from page_views where referrer is null and path = '/';
```

- [ ] **Step 3: 프로덕션 빌드 및 배포**

```bash
cd /c/Users/Eric/portfolio-cosplay
npm run build
npx vercel --prod --yes
```

Expected: 빌드 성공, `https://cos-profile.vercel.app`에 배포 완료 메시지.

- [ ] **Step 4: 실제 배포 사이트에서 동작 확인**

1. 브라우저에서 `https://cos-profile.vercel.app`에 접속(비로그인 상태)해 페이지를 새로고침한다.
2. Supabase 대시보드 → Table Editor → `page_views`에서 방금 방문에 해당하는 행이 새로 생겼는지 확인한다 (`path`가 `/`, `visitor_id`가 UUID).
3. `/admin`에 로그인한 뒤 "방문자 분석" 메뉴를 클릭해 총 방문 수/순 방문자 수/일별 추이/유입 경로가 표시되는지 확인한다.
4. 관리자 상태에서 공개 페이지(`/`)를 새로고침해도 `page_views`에 새 행이 **추가되지 않는지** 확인한다 (관리자 방문 제외 검증).

- [ ] **Step 5: 작업 이력 문서화**

`C:\Users\Eric\portfolio-cosplay\docs\UPDATE_HISTORY.md`을 열어 `## 배포` 섹션 바로 위에 아래 항목을 추가한다.

```markdown
## 2026-08-02 — 방문자 분석

- `page_views` 테이블 추가 — 공개 페이지 방문 시 익명(`anon`) insert, 조회는 `authenticated`만 가능
- `usePageTracking` 훅: 라우트 변경마다 페이지뷰 기록, 관리자 세션·`/admin` 경로는 제외
- `/admin`에 "방문자 분석" 탭 추가 — 총 방문/순 방문자/일별 추이(CSS 막대)/유입 경로(레퍼러) Top 5
- 설계: `docs/superpowers/specs/2026-08-02-visitor-analytics-design.md`

```

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/Eric/portfolio-cosplay
git add docs/UPDATE_HISTORY.md
git commit -m "docs: 방문자 분석 기능 적용 및 검증 완료 기록"
```
