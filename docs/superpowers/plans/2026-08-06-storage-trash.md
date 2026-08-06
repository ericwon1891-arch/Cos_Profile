# 스토리지 파일 삭제(휴지통) 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "스토리지 사용량" 관리자 화면에서 파일을 다중 선택해 휴지통으로 옮기고, 휴지통에서 복원하거나 즉시 영구 삭제할 수 있게 한다. 휴지통 항목은 화면을 열 때마다 14일 경과 여부를 확인해 자동으로 영구 삭제된다.

**Architecture:** 새 DB 테이블 없이 `media` 버킷 안의 `trash/` 폴더로 파일을 이동시키는 방식으로 소프트 삭제를 구현한다. 보관 기간 계산은 Supabase Storage가 이동 시 자동 갱신하는 `updated_at`을 그대로 쓴다. `StorageUsage.jsx`는 루트 폴더와 `trash/` 폴더를 각각 조회해 합산하는 컨테이너로, 렌더링은 `StorageFileList.jsx`(전체 파일 + 다중선택삭제)와 `StorageTrash.jsx`(복원/영구삭제)로 분리한다.

**Tech Stack:** React 19, Vite, Supabase JS(`@supabase/supabase-js`), Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-06-storage-trash-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 컴포넌트·함수만 작성한다. Supabase 호출은 전부 mock 처리해 실제 네트워크 호출이 발생하지 않게 한다.
- 각 작업 단위가 끝날 때마다 커밋한다.
- Task 1~4는 로컬 코드/테스트 변경뿐이라 별도 확인 없이 진행 가능하다 (등급 **중/하**). Task 5의 SQL 파일 작성·커밋까지는 등급 하이지만, **프로덕션 Supabase에 실제로 적용하는 것은 등급 상**(되돌리기 어려운 운영 변경)이다. 이 마이그레이션이 적용되기 전까지는 `StorageFileList`/`StorageTrash`의 이동·삭제 동작이 배포 환경에서 "로그인이 만료되었습니다" 에러로 실패한다는 점을 실행자가 인지하고 있어야 한다.

---

### Task 1: `storageUsage.js`에 휴지통 관련 유틸 함수 추가

**Files:**
- Modify: `src/lib/storageUsage.js`
- Modify: `src/lib/storageUsage.test.js`

**Interfaces:**
- Produces:
  - `TRASH_PREFIX: string` (`'trash/'`)
  - `TRASH_RETENTION_DAYS: number` (`14`)
  - `isFolderPlaceholder(file: {id: string|null}): boolean`
  - `stripTrashPrefix(name: string): string`
  - `daysUntilExpiry(updatedAt: string, now？: number): number` — `now` 생략 시 `Date.now()`
  - `isExpired(updatedAt: string, now?: number): boolean`
  - `describeStorageActionError(error: {message: string}): string` — `'업로드 실패:'` 같은 접두사 없이 이유 문구만 반환(호출부에서 접두사를 붙임)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/storageUsage.test.js` 상단 import를 아래로 교체:
```js
import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  isFolderPlaceholder,
  stripTrashPrefix,
  daysUntilExpiry,
  isExpired,
  describeStorageActionError,
} from './storageUsage'
```

파일 끝에 추가:
```js
describe('isFolderPlaceholder', () => {
  it('id가 null이면 폴더 플레이스홀더로 판별한다', () => {
    expect(isFolderPlaceholder({ id: null, name: 'trash' })).toBe(true)
  })

  it('id가 있으면 폴더 플레이스홀더가 아니다', () => {
    expect(isFolderPlaceholder({ id: 'abc', name: 'a.jpg' })).toBe(false)
  })
})

describe('stripTrashPrefix', () => {
  it('trash/ 접두사를 제거한다', () => {
    expect(stripTrashPrefix('trash/1700000000000.jpg')).toBe('1700000000000.jpg')
  })

  it('trash/ 접두사가 없으면 그대로 반환한다', () => {
    expect(stripTrashPrefix('1700000000000.jpg')).toBe('1700000000000.jpg')
  })
})

describe('daysUntilExpiry', () => {
  it('13일 지났으면 1일 남았다고 계산한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(1)
  })

  it('정확히 14일 지났으면 0을 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(0)
  })

  it('15일 지났으면 음수를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(-1)
  })
})

describe('isExpired', () => {
  it('daysUntilExpiry가 0 이하면 true를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
    expect(isExpired(updatedAt, now)).toBe(true)
  })

  it('daysUntilExpiry가 양수면 false를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString()
    expect(isExpired(updatedAt, now)).toBe(false)
  })
})

describe('describeStorageActionError', () => {
  it('row-level security 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(
      describeStorageActionError({ message: 'new row violates row-level security policy' })
    ).toBe('로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.')
  })

  it('네트워크 관련 메시지면 인터넷 연결 안내를 반환한다', () => {
    expect(describeStorageActionError({ message: 'Failed to fetch' })).toBe(
      '인터넷 연결을 확인해 주세요.'
    )
  })

  it('분류되지 않는 에러는 관리자 문의 안내와 원본 메시지를 함께 반환한다', () => {
    expect(describeStorageActionError({ message: '알 수 없는 서버 오류' })).toBe(
      '문제가 계속되면 관리자에게 문의해 주세요. (알 수 없는 서버 오류)'
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/storageUsage.test.js`
Expected: FAIL — `isFolderPlaceholder` 등이 정의되지 않아 import 에러

- [ ] **Step 3: 최소 구현 작성**

`src/lib/storageUsage.js` 파일 끝에 추가:
```js

export const TRASH_PREFIX = 'trash/'
export const TRASH_RETENTION_DAYS = 14

export function isFolderPlaceholder(file) {
  return file.id === null
}

export function stripTrashPrefix(name) {
  return name.startsWith(TRASH_PREFIX) ? name.slice(TRASH_PREFIX.length) : name
}

export function daysUntilExpiry(updatedAt, now = Date.now()) {
  const elapsedMs = now - new Date(updatedAt).getTime()
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
  return TRASH_RETENTION_DAYS - elapsedDays
}

export function isExpired(updatedAt, now = Date.now()) {
  return daysUntilExpiry(updatedAt, now) <= 0
}

export function describeStorageActionError(error) {
  if (/row-level security|not authorized|unauthorized/i.test(error.message)) {
    return '로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
  }
  if (/network|failed to fetch/i.test(error.message)) {
    return '인터넷 연결을 확인해 주세요.'
  }
  return `문제가 계속되면 관리자에게 문의해 주세요. (${error.message})`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/storageUsage.test.js`
Expected: PASS (기존 8개 + 신규 11개 = 19개)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/storageUsage.js src/lib/storageUsage.test.js
git commit -m "feat: 스토리지 휴지통 관련 유틸 함수 추가"
```

---

### Task 2: `StorageFileList` 컴포넌트 (전체 파일 + 다중선택 삭제)

**Files:**
- Create: `src/components/admin/sections/StorageFileList.jsx`
- Test: `src/components/__tests__/StorageFileList.test.jsx`

**Interfaces:**
- Consumes: `formatBytes` ([[storageUsage.js]], 기존), `supabase.storage.from('media').getPublicUrl(name)` (기존 Top10과 동일 패턴)
- Produces: `export default function StorageFileList({ files: Array<{name, size}>, onDelete: (names: string[]) => Promise<void> })`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageFileList.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StorageFileList from '../admin/sections/StorageFileList'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockGetPublicUrl() {
  const getPublicUrl = vi.fn(name => ({
    data: { publicUrl: `https://example.com/storage/v1/object/public/media/${name}` },
  }))
  supabase.storage.from.mockReturnValue({ getPublicUrl })
  return getPublicUrl
}

describe('StorageFileList', () => {
  it('파일이 없으면 안내 문구를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[]} onDelete={vi.fn()} />)
    expect(screen.getByText('파일이 없습니다.')).toBeInTheDocument()
  })

  it('파일마다 썸네일과 체크박스를 표시하고, 선택 전에는 삭제 버튼이 없다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={vi.fn()} />)

    expect(screen.getByAltText('a.jpg')).toHaveAttribute(
      'src',
      'https://example.com/storage/v1/object/public/media/a.jpg'
    )
    expect(screen.queryByRole('button', { name: /선택 삭제/ })).not.toBeInTheDocument()
  })

  it('체크박스를 선택하면 "선택 삭제(N)" 버튼이 나타나고, 클릭+확인하면 선택된 이름으로 onDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn().mockResolvedValue()

    render(
      <StorageFileList
        files={[{ name: 'a.jpg', size: 1024 }, { name: 'b.jpg', size: 2048 }]}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    expect(screen.getByRole('button', { name: '선택 삭제(1)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    expect(confirmSpy).toHaveBeenCalledWith('선택한 1개 파일을 휴지통으로 이동할까요?')
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(['a.jpg']))

    confirmSpy.mockRestore()
  })

  it('확인 대화상자에서 취소하면 onDelete를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()

    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={onDelete} />)

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: FAIL — `Failed to resolve import "../admin/sections/StorageFileList"`

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageFileList.jsx`:
```jsx
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { formatBytes } from '../../../lib/storageUsage'

export default function StorageFileList({ files, onDelete }) {
  const [selected, setSelected] = useState([])

  function toggle(name) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  async function handleDeleteClick() {
    if (!confirm(`선택한 ${selected.length}개 파일을 휴지통으로 이동할까요?`)) return
    await onDelete(selected)
    setSelected([])
  }

  if (files.length === 0) {
    return <p className="text-sm text-gray-400">파일이 없습니다.</p>
  }

  return (
    <div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="mb-2 text-sm text-red-600 underline"
        >
          선택 삭제({selected.length})
        </button>
      )}
      <ul className="space-y-1">
        {files.map(f => {
          const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
          return (
            <li key={f.name} className="flex items-center justify-between text-sm border-b py-1">
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={selected.includes(f.name)}
                  onChange={() => toggle(f.name)}
                  aria-label={`${f.name} 선택`}
                />
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <img
                    src={publicUrl}
                    alt={f.name}
                    className="w-10 h-10 object-cover rounded shrink-0"
                  />
                </a>
                <span className="truncate">{f.name}</span>
              </span>
              <span className="text-gray-500 shrink-0">{formatBytes(f.size)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: PASS (4개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageFileList.jsx src/components/__tests__/StorageFileList.test.jsx
git commit -m "feat: 전체 파일 다중선택 삭제용 StorageFileList 컴포넌트 추가"
```

---

### Task 3: `StorageTrash` 컴포넌트 (복원 / 즉시 영구삭제)

**Files:**
- Create: `src/components/admin/sections/StorageTrash.jsx`
- Test: `src/components/__tests__/StorageTrash.test.jsx`

**Interfaces:**
- Consumes: `formatBytes`, `daysUntilExpiry`, `stripTrashPrefix` ([[storageUsage.js]], Task 1에서 정의), `supabase.storage.from('media').getPublicUrl(name)`
- Produces: `export default function StorageTrash({ files: Array<{name, size, updatedAt}>, onRestore: (name: string) => Promise<void>, onPermanentDelete: (name: string) => Promise<void> })` — `files[].name`은 `trash/` 접두사가 붙은 전체 경로

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageTrash.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StorageTrash from '../admin/sections/StorageTrash'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockGetPublicUrl() {
  const getPublicUrl = vi.fn(name => ({
    data: { publicUrl: `https://example.com/storage/v1/object/public/media/${name}` },
  }))
  supabase.storage.from.mockReturnValue({ getPublicUrl })
  return getPublicUrl
}

describe('StorageTrash', () => {
  it('휴지통이 비어 있으면 안내 문구를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageTrash files={[]} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)
    expect(screen.getByText('휴지통이 비어 있습니다.')).toBeInTheDocument()
  })

  it('원래 파일명과 남은 보관일을 표시한다', () => {
    mockGetPublicUrl()
    const updatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt }]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('11일 후 영구 삭제')).toBeInTheDocument()
  })

  it('"복원" 버튼을 누르면 onRestore를 원래(휴지통) 경로로 호출한다', () => {
    mockGetPublicUrl()
    const onRestore = vi.fn()
    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={onRestore}
        onPermanentDelete={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '복원' }))
    expect(onRestore).toHaveBeenCalledWith('trash/a.jpg')
  })

  it('"지금 영구 삭제" 버튼을 누르면 확인 후 onPermanentDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onPermanentDelete = vi.fn().mockResolvedValue()

    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={vi.fn()}
        onPermanentDelete={onPermanentDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '지금 영구 삭제' }))

    expect(confirmSpy).toHaveBeenCalledWith('이 파일을 지금 영구 삭제할까요? 되돌릴 수 없습니다.')
    await waitFor(() => expect(onPermanentDelete).toHaveBeenCalledWith('trash/a.jpg'))

    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageTrash.test.jsx`
Expected: FAIL — `Failed to resolve import "../admin/sections/StorageTrash"`

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageTrash.jsx`:
```jsx
import { supabase } from '../../../lib/supabaseClient'
import { formatBytes, daysUntilExpiry, stripTrashPrefix } from '../../../lib/storageUsage'

export default function StorageTrash({ files, onRestore, onPermanentDelete }) {
  if (files.length === 0) {
    return <p className="text-sm text-gray-400">휴지통이 비어 있습니다.</p>
  }

  async function handlePermanentDeleteClick(name) {
    if (!confirm('이 파일을 지금 영구 삭제할까요? 되돌릴 수 없습니다.')) return
    await onPermanentDelete(name)
  }

  return (
    <ul className="space-y-1">
      {files.map(f => {
        const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
        const displayName = stripTrashPrefix(f.name)
        const remaining = daysUntilExpiry(f.updatedAt)
        return (
          <li key={f.name} className="flex items-center justify-between text-sm border-b py-1 gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <img
                  src={publicUrl}
                  alt={displayName}
                  className="w-10 h-10 object-cover rounded shrink-0"
                />
              </a>
              <span className="truncate">{displayName}</span>
              <span className="text-gray-400 shrink-0">{formatBytes(f.size)}</span>
              <span className="text-gray-400 shrink-0">{remaining}일 후 영구 삭제</span>
            </span>
            <span className="flex gap-2 shrink-0">
              <button type="button" onClick={() => onRestore(f.name)} className="underline">
                복원
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDeleteClick(f.name)}
                className="underline text-red-600"
              >
                지금 영구 삭제
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageTrash.test.jsx`
Expected: PASS (4개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageTrash.jsx src/components/__tests__/StorageTrash.test.jsx
git commit -m "feat: 휴지통 복원/영구삭제용 StorageTrash 컴포넌트 추가"
```

---

### Task 4: `StorageUsage` 컨테이너 배선 (루트+휴지통 조회, 합산, 자동만료청소)

**Files:**
- Modify: `src/components/admin/sections/StorageUsage.jsx` (전체 교체)
- Modify: `src/components/__tests__/StorageUsage.test.jsx` (전체 교체)

**Interfaces:**
- Consumes: `fetchAllStorageFiles`, `totalBytes`, `formatBytes`, `usagePercent`, `topLargestFiles`, `isFolderPlaceholder`, `isExpired`, `stripTrashPrefix`, `describeStorageActionError`, `STORAGE_LIMIT_GB`, `TRASH_PREFIX` (Task 1), `StorageFileList` (Task 2), `StorageTrash` (Task 3)
- Produces: 변경 없음 (`export default function StorageUsage()`, props 없음)

**현재 코드 전체** (`src/components/admin/sections/StorageUsage.jsx`) — 이 파일 전체를 아래 "최소 구현"으로 교체한다.

- [ ] **Step 1: 실패하는 테스트 작성 (기존 파일 전체 교체)**

`src/components/__tests__/StorageUsage.test.jsx` 전체를 다음으로 교체:
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StorageUsage from '../admin/sections/StorageUsage'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockStorage({ root = [], trash = [] } = {}) {
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
  return { list, getPublicUrl, move, remove }
}

describe('StorageUsage', () => {
  it('루트 파일과 휴지통 파일의 합계를 총 사용량으로 표시한다', async () => {
    mockStorage({
      root: [
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 * 1024 } },
      ],
      trash: [
        { id: '2', name: 'b.jpg', updated_at: new Date().toISOString(), metadata: { size: 2 * 1024 * 1024 } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('3.0MB')
  })

  it('폴더 플레이스홀더 항목은 목록/합계에서 제외한다', async () => {
    mockStorage({
      root: [
        { id: null, name: 'trash', updated_at: null, metadata: null },
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 * 1024 } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('1.0MB')
  })

  it('14일 지난 휴지통 파일은 마운트 시 자동으로 영구 삭제한다', async () => {
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const recent = new Date().toISOString()
    const { remove } = mockStorage({
      trash: [
        { id: '1', name: 'old.jpg', updated_at: old, metadata: { size: 1024 } },
        { id: '2', name: 'recent.jpg', updated_at: recent, metadata: { size: 1024 } },
      ],
    })

    render(<StorageUsage />)

    await waitFor(() => expect(remove).toHaveBeenCalledWith(['trash/old.jpg']))
    await screen.findByText('휴지통 (14일 후 자동 삭제)')
    expect(screen.queryByAltText('old.jpg')).not.toBeInTheDocument()
    expect(screen.getByText('recent.jpg')).toBeInTheDocument()
  })

  it('"전체 파일 보기"를 열면 체크박스로 선택한 파일을 휴지통으로 이동한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { move } = mockStorage({
      root: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    fireEvent.click(screen.getByRole('button', { name: '전체 파일 보기' }))

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith('a.jpg', 'trash/a.jpg'))
    confirmSpy.mockRestore()
  })

  it('휴지통 항목의 "복원" 버튼을 누르면 원래 경로로 되돌린다', async () => {
    const { move } = mockStorage({
      trash: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '복원' }))
    fireEvent.click(screen.getByRole('button', { name: '복원' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith('trash/a.jpg', 'a.jpg'))
  })

  it('휴지통 항목의 "지금 영구 삭제" 버튼을 누르면 확인 후 즉시 삭제한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { remove } = mockStorage({
      trash: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '지금 영구 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: '지금 영구 삭제' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith(['trash/a.jpg']))
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: FAIL — 컨테이너가 아직 루트+휴지통을 함께 조회하지 않고, "전체 파일 보기"/"휴지통" 텍스트도 없음

- [ ] **Step 3: 최소 구현 작성 (기존 파일 전체 교체)**

`src/components/admin/sections/StorageUsage.jsx` 전체를 다음으로 교체:
```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
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

  async function moveFiles(names, toTrash) {
    for (const name of names) {
      const targetPath = toTrash ? `${TRASH_PREFIX}${name}` : stripTrashPrefix(name)
      const { error } = await supabase.storage.from('media').move(name, targetPath)
      if (error) {
        alert(`작업 실패: ${describeStorageActionError(error)}`)
        return
      }
    }
    setReloadToken(t => t + 1)
  }

  async function handleDelete(names) {
    await moveFiles(names, true)
  }

  async function handleRestore(trashName) {
    await moveFiles([trashName], false)
  }

  async function handlePermanentDelete(trashName) {
    const { error } = await supabase.storage.from('media').remove([trashName])
    if (error) {
      alert(`작업 실패: ${describeStorageActionError(error)}`)
      return
    }
    setReloadToken(t => t + 1)
  }

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

  const { rootFiles, trashFiles } = state
  const usedBytes = totalBytes(rootFiles) + totalBytes(trashFiles)
  const percent = usagePercent(usedBytes, STORAGE_LIMIT_GB)
  const largest = topLargestFiles(rootFiles, 10)
  const allFiles = topLargestFiles(rootFiles, rootFiles.length)
  const trashList = trashFiles
    .map(f => ({ name: f.name, size: f.metadata?.size ?? 0, updatedAt: f.updated_at }))
    .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 사용량</p>
          <p className="text-2xl font-bold">{formatBytes(usedBytes)}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">한도 대비 사용률 (Free {STORAGE_LIMIT_GB}GB 기준)</p>
          <p className="text-2xl font-bold">{percent}%</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">용량 큰 파일 Top 10</h3>
      {largest.length === 0 && <p className="text-sm text-gray-400">파일이 없습니다.</p>}
      {largest.length > 0 && (
        <ul className="space-y-1 mb-8">
          {largest.map(f => {
            const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
            return (
              <li key={f.name} className="flex items-center justify-between text-sm border-b py-1">
                <span className="flex items-center gap-2 min-w-0">
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <img
                      src={publicUrl}
                      alt={f.name}
                      className="w-10 h-10 object-cover rounded shrink-0"
                    />
                  </a>
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-gray-500 shrink-0">{formatBytes(f.size)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowAllFiles(v => !v)}
        className="mb-2 text-sm underline"
      >
        {showAllFiles ? '전체 파일 접기' : '전체 파일 보기'}
      </button>
      {showAllFiles && (
        <div className="mb-8">
          <StorageFileList files={allFiles} onDelete={handleDelete} />
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">휴지통 (14일 후 자동 삭제)</h3>
      <StorageTrash
        files={trashList}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: PASS (6개)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/sections/StorageUsage.jsx src/components/__tests__/StorageUsage.test.jsx
git commit -m "feat: 스토리지 사용량 화면에 전체 파일 다중선택 삭제와 휴지통 연결"
```

---

### Task 5: DB 마이그레이션 — 파일 이동/삭제 권한 (등급 상 — 프로덕션 DB 변경, 적용 전 확인 필수)

**Files:**
- Create: `supabase/update-storage-trash.sql`

**배경**: `media` 버킷에는 현재 `INSERT`(업로드), `SELECT`(목록조회) 정책만 있다. `StorageFileList`(삭제=이동), `StorageTrash`(복원=이동, 영구삭제=삭제)가 쓰는 `storage.move()`/`storage.remove()`는 각각 `UPDATE`/`DELETE` 권한이 필요하다. 이 정책 없이는 Task 1~4가 로컬 테스트는 통과하지만 배포 환경에서 "로그인이 만료되었습니다" 에러가 뜬다.

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

`supabase/update-storage-trash.sql`:
```sql
-- 스토리지 사용량 화면의 휴지통 기능(파일 이동/영구삭제)이 동작하도록
-- authenticated 역할에 한정해 UPDATE(이동)/DELETE(영구삭제) 권한을 부여.
create policy "media authenticated move" on storage.objects
  for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
```

- [ ] **Step 2: 파일을 커밋한다 (아직 프로덕션에는 적용하지 않음)**

```bash
git add supabase/update-storage-trash.sql
git commit -m "feat: 스토리지 휴지통용 이동/삭제 권한 마이그레이션 추가"
```

- [ ] **Step 3: 프로덕션에 적용**

Supabase 대시보드(`https://supabase.com/dashboard/project/mjrfuktpqqqtvtbadxlj/sql/new`)의 SQL Editor에서 Step 1의 SQL을 실행한다.

- [ ] **Step 4: 배포된 사이트에서 동작 확인**

프로덕션 배포 후 `https://cos-profile.vercel.app/admin`에 로그인해 "스토리지 사용량" 화면에서 "전체 파일 보기" → 파일 선택 → "선택 삭제" → 휴지통에 나타나는지, "복원"/"지금 영구 삭제"가 각각 동작하는지 확인한다.

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 "아키텍처"(trash 폴더 방식, 메타데이터 기반 만료) → Task 1. "DB 마이그레이션" → Task 5. "컴포넌트 설계"의 `StorageFileList`/`StorageTrash`/컨테이너 배선 → Task 2/3/4. "에러 처리" → Task 4에서 `describeStorageActionError` 사용. "테스트 계획" 전 항목에 대응하는 테스트 파일 존재.
- **플레이스홀더 스캔**: TBD/TODO 없음.
- **타입/시그니처 일관성**: `isFolderPlaceholder`, `stripTrashPrefix`, `daysUntilExpiry`, `isExpired`, `describeStorageActionError`, `TRASH_PREFIX`, `TRASH_RETENTION_DAYS`가 Task 1에서 정의된 그대로 Task 2~4에서 사용됨. `StorageFileList`/`StorageTrash`의 props 시그니처가 Task 4의 컨테이너 사용부와 일치.
