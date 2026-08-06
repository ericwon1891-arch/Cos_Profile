# 미사용 파일 배지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "스토리지 사용량 > 전체 파일 보기" 목록에서, `site_content`(게시된 사이트 콘텐츠) 어디에서도 참조되지 않는 파일에 "미사용" 배지를 표시한다.

**Architecture:** `site_content` 전체 행의 `data`(JSONB)를 `JSON.stringify` 후 정규식으로 `.../media/<path>` 패턴을 추출해 "게시된 파일 경로 집합"을 만든다. `StorageUsage.jsx`가 루트/휴지통 스토리지 조회와 함께 이 집합을 계산해 `StorageFileList`에 넘기고, 거기 없는 파일에 배지를 그린다.

**Tech Stack:** React 19, Vite, Supabase JS(`@supabase/supabase-js`), Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-06-media-usage-badge-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 컴포넌트·함수만 작성한다. Supabase 호출은 전부 mock 처리한다.
- 각 작업 단위가 끝날 때마다 커밋한다.
- 전부 로컬 코드/테스트 변경뿐이라(DB 마이그레이션 없음, `site_content` SELECT는 이미 공개 정책으로 허용됨) 별도 확인 없이 진행 가능하다 (등급 **하**).

---

### Task 1: `mediaUsage.js` — `extractMediaPaths` 유틸

**Files:**
- Create: `src/lib/mediaUsage.js`
- Test: `src/lib/mediaUsage.test.js`

**Interfaces:**
- Produces: `extractMediaPaths(data: unknown): string[]` — `data`(임의의 JSON 값, `null`/`undefined` 허용)에서 `.../storage/v1/object/public/media/<path>` 패턴을 전부 찾아 `<path>` 부분만 배열로 반환한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/mediaUsage.test.js`:
```js
import { extractMediaPaths } from './mediaUsage'

describe('extractMediaPaths', () => {
  it('중첩된 객체/배열 안의 media URL을 모두 추출한다', () => {
    const data = {
      hero: { imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000000.jpg' },
      characters: [
        { name: 'A', imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000001.jpg' },
        { name: 'B', imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000002.jpg' },
      ],
    }
    expect(extractMediaPaths(data)).toEqual([
      '1700000000000.jpg',
      '1700000000001.jpg',
      '1700000000002.jpg',
    ])
  })

  it('media URL이 아닌 문자열은 무시한다', () => {
    const data = { title: '안녕하세요', link: 'https://example.com/about' }
    expect(extractMediaPaths(data)).toEqual([])
  })

  it('data가 null/undefined면 빈 배열을 반환한다', () => {
    expect(extractMediaPaths(null)).toEqual([])
    expect(extractMediaPaths(undefined)).toEqual([])
  })

  it('data가 빈 객체면 빈 배열을 반환한다', () => {
    expect(extractMediaPaths({})).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/mediaUsage.test.js`
Expected: FAIL — `Failed to resolve import "./mediaUsage"`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/mediaUsage.js`:
```js
export function extractMediaPaths(data) {
  const text = JSON.stringify(data ?? {})
  const matches = text.matchAll(/\/storage\/v1\/object\/public\/media\/([^"\\]+)/g)
  return [...matches].map(m => m[1])
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/mediaUsage.test.js`
Expected: PASS (4개)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/mediaUsage.js src/lib/mediaUsage.test.js
git commit -m "feat: 게시된 콘텐츠에서 media URL 경로를 추출하는 extractMediaPaths 유틸 추가"
```

---

### Task 2: `StorageFileList`에 "미사용" 배지 추가

**Files:**
- Modify: `src/components/admin/sections/StorageFileList.jsx`
- Modify: `src/components/__tests__/StorageFileList.test.jsx`

**Interfaces:**
- Consumes: 없음 (새 의존성 없음, `usedPaths`는 상위 컴포넌트가 계산해서 prop으로 넘겨줌)
- Produces: `export default function StorageFileList({ files, usedPaths?: Set<string>, onDelete })` — `usedPaths` 생략 시 빈 `Set`으로 기본 처리(모든 파일이 미사용으로 표시됨)

**현재 코드** (`src/components/admin/sections/StorageFileList.jsx:1,5,54`):
```js
import { useState } from 'react'
...
export default function StorageFileList({ files, onDelete }) {
...
                <span className="truncate">{f.name}</span>
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageFileList.test.jsx` 상단 import에 `within` 추가:
```js
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
```

파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('usedPaths에 없는 파일에는 "미사용" 배지를 표시한다', () => {
    mockGetPublicUrl()
    render(
      <StorageFileList
        files={[{ name: 'used.jpg', size: 1024 }, { name: 'orphan.jpg', size: 1024 }]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={vi.fn()}
      />
    )

    const usedItem = screen.getByText('used.jpg').closest('li')
    const orphanItem = screen.getByText('orphan.jpg').closest('li')
    expect(within(usedItem).queryByText('미사용')).not.toBeInTheDocument()
    expect(within(orphanItem).getByText('미사용')).toBeInTheDocument()
  })

  it('usedPaths를 생략하면 모든 파일에 "미사용" 배지를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={vi.fn()} />)
    expect(screen.getByText('미사용')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: FAIL — "미사용" 텍스트를 찾지 못함 (배지가 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageFileList.jsx`의 함수 시그니처를 다음으로 교체:
```js
export default function StorageFileList({ files, usedPaths = new Set(), onDelete }) {
```

`<span className="truncate">{f.name}</span>` 줄을 다음으로 교체:
```jsx
                <span className="truncate">{f.name}</span>
                {!usedPaths.has(f.name) && (
                  <span className="text-xs text-orange-600 border border-orange-300 rounded px-1 shrink-0">
                    미사용
                  </span>
                )}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: PASS (6개 — 기존 4개 + 신규 2개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageFileList.jsx src/components/__tests__/StorageFileList.test.jsx
git commit -m "feat: StorageFileList에 미사용 파일 배지 추가"
```

---

### Task 3: `StorageUsage` 컨테이너에서 `usedPaths` 계산해 연결

**Files:**
- Modify: `src/components/admin/sections/StorageUsage.jsx`
- Modify: `src/components/__tests__/StorageUsage.test.jsx`

**Interfaces:**
- Consumes: `extractMediaPaths` (Task 1), `StorageFileList`의 `usedPaths` prop (Task 2)
- Produces: 변경 없음 (`export default function StorageUsage()`, props 없음)

**현재 코드** (`src/components/admin/sections/StorageUsage.jsx`):
```js
import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  isFolderPlaceholder,
  isExpired,
  stripTrashPrefix,
  describeStorageActionError,
  STORAGE_LIMIT_GB,
  TRASH_PREFIX,
} from '../../../lib/storageUsage'
import StorageFileList from './StorageFileList'
import StorageTrash from './StorageTrash'

export default function StorageUsage() {
  const [reloadToken, setReloadToken] = useState(0)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const [state, setState] = useState({ rootFiles: null, trashFiles: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rootFiles: null, trashFiles: null, loading: true, error: null })

    async function fetchFiles() {
      try {
        const [rootRaw, trashRaw] = await Promise.all([
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('trash', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
        ])

        const rootFiles = rootRaw.filter(f => !isFolderPlaceholder(f))
        const trashPrefixed = trashRaw
          .filter(f => !isFolderPlaceholder(f))
          .map(f => ({ ...f, name: `${TRASH_PREFIX}${f.name}` }))

        const expired = trashPrefixed.filter(f => isExpired(f.updated_at))
        const active = trashPrefixed.filter(f => !isExpired(f.updated_at))

        if (expired.length > 0) {
          await supabase.storage.from('media').remove(expired.map(f => f.name))
        }

        if (cancelled) return
        setState({ rootFiles, trashFiles: active, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ rootFiles: null, trashFiles: null, loading: false, error })
      }
    }

    fetchFiles()

    return () => { cancelled = true }
  }, [reloadToken])
```
그리고 렌더링부(파일 마지막 부분):
```js
  const { rootFiles, trashFiles } = state
  const usedBytes = totalBytes(rootFiles) + totalBytes(trashFiles)
  ...
      {showAllFiles && (
        <div className="mb-8">
          <StorageFileList files={allFiles} onDelete={handleDelete} />
        </div>
      )}
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageUsage.test.jsx` 상단 mock 팩토리를 다음으로 교체(`from` 추가):
```js
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() }, from: vi.fn() },
}))
```

`mockStorage` 헬퍼를 다음으로 교체(`content` 옵션 추가):
```js
function mockStorage({ root = [], trash = [], content = [] } = {}) {
  const list = vi.fn(path => {
    if (path === 'trash') return Promise.resolve({ data: trash, error: null })
    return Promise.resolve({ data: root, error: null })
  })
  const getPublicUrl = vi.fn(name => ({
    data: { publicUrl: `https://example.com/storage/v1/object/public/media/${name}` },
  }))
  const move = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  supabase.storage.from.mockReturnValue({ list, getPublicUrl, move, remove })

  const select = vi.fn().mockResolvedValue({
    data: content.map(data => ({ data })),
    error: null,
  })
  supabase.from.mockReturnValue({ select })

  return { list, getPublicUrl, move, remove, select }
}
```

"조회 실패 시 에러 메시지와..." 테스트에서 `supabase.storage.from.mockReturnValue({ list, getPublicUrl, move: vi.fn(), remove: vi.fn() })` 바로 뒤에 추가:
```js
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
```

파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('게시된 콘텐츠에서 참조되지 않는 파일에는 미사용 배지를, 참조되는 파일에는 표시하지 않는다', async () => {
    mockStorage({
      root: [
        { id: '1', name: 'used.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
        { id: '2', name: 'orphan.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
      ],
      content: [
        { hero: { imageUrl: 'https://example.com/storage/v1/object/public/media/used.jpg' } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    fireEvent.click(screen.getByRole('button', { name: '전체 파일 보기' }))

    const usedItem = screen.getByText('used.jpg').closest('li')
    const orphanItem = screen.getByText('orphan.jpg').closest('li')
    await waitFor(() => expect(within(orphanItem).getByText('미사용')).toBeInTheDocument())
    expect(within(usedItem).queryByText('미사용')).not.toBeInTheDocument()
  })

  it('site_content 조회 실패 시 에러 상태로 전환된다', async () => {
    mockStorage({ root: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }] })
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: '실패' } }),
    })

    render(<StorageUsage />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: FAIL — 신규 2개 테스트 실패("미사용" 배지가 없음 / `supabase.from`이 정의되지 않아 다른 기존 테스트도 함께 깨질 수 있음)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageUsage.jsx` import에 추가:
```js
import { extractMediaPaths } from '../../../lib/mediaUsage'
```

`useState` 초기값과 리셋 부분의 `{ rootFiles: null, trashFiles: null, loading: true, error: null }`를 전부 `{ rootFiles: null, trashFiles: null, usedPaths: null, loading: true, error: null }`로 교체(두 곳: `useState(...)` 호출부와 `useEffect` 안의 리셋 `setState(...)` 호출부).

`fetchFiles` 함수 내부를 다음으로 교체:
```js
    async function fetchFiles() {
      try {
        const [rootRaw, trashRaw, contentRows] = await Promise.all([
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('trash', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
          supabase.from('site_content').select('data').then(({ data, error }) => {
            if (error) throw error
            return data
          }),
        ])

        const rootFiles = rootRaw.filter(f => !isFolderPlaceholder(f))
        const trashPrefixed = trashRaw
          .filter(f => !isFolderPlaceholder(f))
          .map(f => ({ ...f, name: `${TRASH_PREFIX}${f.name}` }))

        const expired = trashPrefixed.filter(f => isExpired(f.updated_at))
        const active = trashPrefixed.filter(f => !isExpired(f.updated_at))

        if (expired.length > 0) {
          await supabase.storage.from('media').remove(expired.map(f => f.name))
        }

        const usedPaths = new Set(contentRows.flatMap(row => extractMediaPaths(row.data)))

        if (cancelled) return
        setState({ rootFiles, trashFiles: active, usedPaths, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ rootFiles: null, trashFiles: null, usedPaths: null, loading: false, error })
      }
    }
```

렌더링부에서 `const { rootFiles, trashFiles } = state`를 `const { rootFiles, trashFiles, usedPaths } = state`로 교체.

`<StorageFileList files={allFiles} onDelete={handleDelete} />`를 다음으로 교체:
```jsx
          <StorageFileList files={allFiles} usedPaths={usedPaths} onDelete={handleDelete} />
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: PASS (전체 — 기존 10개 + 신규 2개 = 12개)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/sections/StorageUsage.jsx src/components/__tests__/StorageUsage.test.jsx
git commit -m "feat: 스토리지 사용량 화면에서 게시된 콘텐츠 기준 미사용 파일 배지 연결"
```

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 "아키텍처"(JSON.stringify + 정규식 추출) → Task 1. "컴포넌트 변경"의 `StorageFileList`/`StorageUsage` → Task 2/3. "에러 처리"(site_content 실패 시 기존 에러 상태 재사용) → Task 3. "테스트 계획" 전 항목 대응.
- **플레이스홀더 스캔**: TBD/TODO 없음.
- **타입/시그니처 일관성**: `extractMediaPaths(data)`가 Task 1에서 정의된 그대로 Task 3에서 사용됨. `StorageFileList`의 `usedPaths` prop 시그니처가 Task 2 정의와 Task 3 사용부에서 일치.
