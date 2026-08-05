# 한글 파일명 업로드 오류 수정 + 스토리지 사용량 관리자 메뉴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 한글(비-ASCII) 파일명의 사진을 올려도 업로드가 실패하지 않게 고치고, 관리자 화면에 Supabase 스토리지 전체 사용량을 보여주는 메뉴를 추가한다.

**Architecture:** `ImageField`의 업로드 경로 생성 로직을 원본 파일명 대신 `타임스탬프.확장자`로 바꿔 Supabase Storage의 `InvalidKey` 400 에러를 근본적으로 제거한다. 스토리지 사용량은 새 서버 컴포넌트 없이 `supabase.storage.list()`를 관리자 화면에서 직접 호출해 계산한다(순수 프론트엔드 + Supabase 아키텍처 유지).

**Tech Stack:** React 19, Vite, Supabase JS(`@supabase/supabase-js`), Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-05-korean-filename-fix-storage-usage-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 컴포넌트·함수만 작성한다. Supabase 호출은 전부 mock 처리해 실제 네트워크 호출이 발생하지 않게 한다 (프로젝트 `CLAUDE.md` 테스트 원칙).
- 각 작업 단위가 끝날 때마다 커밋한다.
- 프로덕션 Supabase 프로젝트(`mjrfuktpqqqtvtbadxlj`)에 마이그레이션을 실제로 적용하는 작업은 되돌리기 어려운 운영 변경이므로, 실행 전 반드시 사용자에게 명시적으로 확인받은 뒤 진행한다 (Task 6, 등급 **상**). 나머지 작업(Task 1~5)은 로컬 코드/테스트 변경뿐이라 별도 확인 없이 진행 가능하다 (등급 **중/하**).

---

### Task 1: 업로드 경로 생성 유틸리티 (`buildUploadPath`)

**Files:**
- Create: `src/lib/uploadPath.js`
- Test: `src/lib/uploadPath.test.js`

**Interfaces:**
- Produces: `buildUploadPath(fileName: string, timestamp?: number): string` — 원본 파일명과 관계없이 `${timestamp}.${확장자}` 형태의 안전한 스토리지 키를 반환한다. 확장자가 없으면 `jpg`로 폴백하고, 확장자는 항상 소문자로 정규화한다. `timestamp` 생략 시 `Date.now()`를 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/uploadPath.test.js`:
```js
import { buildUploadPath } from './uploadPath'

describe('buildUploadPath', () => {
  it('영문 파일명이면 타임스탬프+확장자로 변환한다', () => {
    expect(buildUploadPath('photo.jpg', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('한글이 포함된 파일명도 확장자만 남기고 안전하게 변환한다', () => {
    expect(buildUploadPath('SIH_0026-편집.jpg', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('확장자가 없으면 jpg로 폴백한다', () => {
    expect(buildUploadPath('photo', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('확장자를 소문자로 정규화한다', () => {
    expect(buildUploadPath('PHOTO.JPG', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('파일명에 점이 여러 개면 마지막 점 기준으로 확장자를 판단한다', () => {
    expect(buildUploadPath('my.photo.jpeg', 1700000000000)).toBe('1700000000000.jpeg')
  })

  it('timestamp를 생략하면 Date.now()를 사용한다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    expect(buildUploadPath('photo.png')).toBe('1234567890.png')
    Date.now.mockRestore()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/uploadPath.test.js`
Expected: FAIL — `Failed to resolve import "./uploadPath"` (파일이 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/lib/uploadPath.js`:
```js
export function buildUploadPath(fileName, timestamp = Date.now()) {
  const lastDot = fileName.lastIndexOf('.')
  const ext = lastDot === -1 ? 'jpg' : fileName.slice(lastDot + 1).toLowerCase()
  return `${timestamp}.${ext}`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/uploadPath.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/uploadPath.js src/lib/uploadPath.test.js
git commit -m "feat: 업로드 경로에서 원본 파일명 대신 타임스탬프+확장자 사용하는 유틸 추가"
```

---

### Task 2: `ImageField`가 `buildUploadPath`를 사용하도록 수정

**Files:**
- Modify: `src/components/admin/fields/ImageField.jsx:1-9`
- Test: `src/components/__tests__/ImageField.test.jsx` (신규)

**Interfaces:**
- Consumes: `buildUploadPath(fileName, timestamp?)` (Task 1에서 정의)
- Produces: 변경 없음 (기존 `ImageField` props `{ label, value, onChange, hint }` 그대로 유지)

**현재 코드** (`src/components/admin/fields/ImageField.jsx`):
```js
import { supabase } from '../../../lib/supabaseClient'

export default function ImageField({ label, value, onChange, hint }) {
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    const path = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('media').upload(path, file)
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/ImageField.test.jsx`:
```jsx
import { render, fireEvent, waitFor } from '@testing-library/react'
import ImageField from '../admin/fields/ImageField'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function makeFile(name) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('ImageField', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('한글 파일명이어도 타임스탬프+확장자 경로로 업로드한다', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/media/1700000000000.jpg' } })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl })
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    const file = makeFile('SIH_0026-편집.jpg')

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://x/media/1700000000000.jpg'))
    expect(upload).toHaveBeenCalledWith('1700000000000.jpg', file)
  })

  it('업로드 실패(413) 시 용량 안내 alert를 띄운다', async () => {
    const upload = vi.fn().mockResolvedValue({ error: { statusCode: '413', message: 'Payload too large' } })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl: vi.fn() })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg')] } })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
      )
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/ImageField.test.jsx`
Expected: FAIL — 첫 번째 테스트에서 `upload`가 `'1700000000000-SIH_0026-편집.jpg'`로 호출되어 `toHaveBeenCalledWith('1700000000000.jpg', file)` 불일치

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/fields/ImageField.jsx`의 import와 path 생성 부분을 다음과 같이 수정:
```js
import { supabase } from '../../../lib/supabaseClient'
import { buildUploadPath } from '../../../lib/uploadPath'

export default function ImageField({ label, value, onChange, hint }) {
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    const path = buildUploadPath(file.name)
    const { error } = await supabase.storage.from('media').upload(path, file)
```
(이후 코드는 변경 없음)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/ImageField.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 기존 테스트(HeroForm 등 `ImageField`를 사용하는 폼)를 포함해 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/fields/ImageField.jsx src/components/__tests__/ImageField.test.jsx
git commit -m "fix: 이미지 업로드 경로에서 원본 파일명 제거 - 한글 파일명 InvalidKey 오류 수정"
```

---

### Task 3: 스토리지 사용량 계산 유틸리티

**Files:**
- Create: `src/lib/storageUsage.js`
- Test: `src/lib/storageUsage.test.js`

**Interfaces:**
- Produces:
  - `STORAGE_LIMIT_GB: number` — Free Plan 실측 한도(1). 요금제가 바뀌면 이 값만 수정하면 된다.
  - `fetchAllStorageFiles(listPage: (offset: number, limit: number) => Promise<{data, error}>, pageSize?: number): Promise<Array<{name, metadata}>>` — 페이지네이션을 반복하며 전체 파일 목록을 모은다. `error`가 있으면 throw한다.
  - `totalBytes(files: Array<{metadata?: {size?: number}}>): number`
  - `formatBytes(bytes: number): string` — 1GB 미만이면 `"x.xMB"`, 이상이면 `"x.xxGB"`
  - `usagePercent(bytes: number, limitGB: number): number` — 소수 첫째 자리까지
  - `topLargestFiles(files, limit?: number): Array<{name: string, size: number}>` — 크기 내림차순

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/storageUsage.test.js`:
```js
import { fetchAllStorageFiles, totalBytes, formatBytes, usagePercent, topLargestFiles } from './storageUsage'

describe('fetchAllStorageFiles', () => {
  it('전체 결과가 페이지 크기보다 작으면 한 번만 호출한다', async () => {
    const listPage = vi.fn().mockResolvedValue({ data: [{ name: 'a' }], error: null })
    const files = await fetchAllStorageFiles(listPage, 10)
    expect(files).toEqual([{ name: 'a' }])
    expect(listPage).toHaveBeenCalledTimes(1)
    expect(listPage).toHaveBeenCalledWith(0, 10)
  })

  it('결과가 페이지 크기와 같으면 다음 페이지를 이어서 조회한다', async () => {
    const listPage = vi.fn()
      .mockResolvedValueOnce({ data: [{ name: 'a' }, { name: 'b' }], error: null })
      .mockResolvedValueOnce({ data: [{ name: 'c' }], error: null })
    const files = await fetchAllStorageFiles(listPage, 2)
    expect(files.map(f => f.name)).toEqual(['a', 'b', 'c'])
    expect(listPage).toHaveBeenCalledTimes(2)
    expect(listPage).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('에러가 있으면 던진다', async () => {
    const listPage = vi.fn().mockResolvedValue({ data: null, error: { message: '실패' } })
    await expect(fetchAllStorageFiles(listPage, 10)).rejects.toEqual({ message: '실패' })
  })
})

describe('totalBytes', () => {
  it('모든 파일의 metadata.size 합을 반환한다', () => {
    expect(totalBytes([{ metadata: { size: 100 } }, { metadata: { size: 200 } }])).toBe(300)
  })

  it('metadata가 없으면 0으로 취급한다', () => {
    expect(totalBytes([{ metadata: { size: 100 } }, {}])).toBe(100)
  })
})

describe('formatBytes', () => {
  it('1GB 미만이면 MB로 표시한다', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB')
  })

  it('1GB 이상이면 GB로 표시한다', () => {
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50GB')
  })
})

describe('usagePercent', () => {
  it('한도 대비 사용률을 소수 첫째 자리까지 반환한다', () => {
    expect(usagePercent(0.005 * 1024 * 1024 * 1024, 1)).toBe(0.5)
  })
})

describe('topLargestFiles', () => {
  it('크기 내림차순으로 상위 N개를 반환한다', () => {
    const files = [
      { name: 'a', metadata: { size: 10 } },
      { name: 'b', metadata: { size: 30 } },
      { name: 'c', metadata: { size: 20 } },
    ]
    expect(topLargestFiles(files, 2)).toEqual([
      { name: 'b', size: 30 },
      { name: 'c', size: 20 },
    ])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/storageUsage.test.js`
Expected: FAIL — `Failed to resolve import "./storageUsage"`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/storageUsage.js`:
```js
export const STORAGE_LIMIT_GB = 1 // Free Plan 실측값(2026-08-05). 요금제 변경 시 이 값을 수정하세요.

export async function fetchAllStorageFiles(listPage, pageSize = 1000) {
  let offset = 0
  let all = []
  while (true) {
    const { data, error } = await listPage(offset, pageSize)
    if (error) throw error
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

export function totalBytes(files) {
  return files.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
}

export function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)}MB`
  return `${(mb / 1024).toFixed(2)}GB`
}

export function usagePercent(bytes, limitGB) {
  const limitBytes = limitGB * 1024 * 1024 * 1024
  return Math.round((bytes / limitBytes) * 1000) / 10
}

export function topLargestFiles(files, limit = 10) {
  return [...files]
    .map(f => ({ name: f.name, size: f.metadata?.size ?? 0 }))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/storageUsage.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/storageUsage.js src/lib/storageUsage.test.js
git commit -m "feat: 스토리지 사용량 계산 유틸(전체 조회/합계/포맷/상위 파일) 추가"
```

---

### Task 4: `StorageUsage` 관리자 화면 컴포넌트

**Files:**
- Create: `src/components/admin/sections/StorageUsage.jsx`
- Test: `src/components/__tests__/StorageUsage.test.jsx`

**Interfaces:**
- Consumes: `fetchAllStorageFiles`, `totalBytes`, `formatBytes`, `usagePercent`, `topLargestFiles`, `STORAGE_LIMIT_GB` (Task 3에서 정의), `supabase.storage.from('media').list(path, opts)` (Supabase JS 표준 API)
- Produces: `export default function StorageUsage()` — props 없음. `AdminDashboard`에서 `<StorageUsage />`로 렌더링한다 (Task 5).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageUsage.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import StorageUsage from '../admin/sections/StorageUsage'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockList(result) {
  const list = vi.fn().mockResolvedValue(result)
  supabase.storage.from.mockReturnValue({ list })
  return list
}

describe('StorageUsage', () => {
  it('총 사용량을 표시한다', async () => {
    mockList({
      data: [
        { name: 'a.jpg', metadata: { size: 1024 * 1024 } },
        { name: 'b.jpg', metadata: { size: 2 * 1024 * 1024 } },
      ],
      error: null,
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('3.0MB')
  })

  it('용량 큰 파일 Top 10을 내림차순으로 표시한다', async () => {
    mockList({
      data: [
        { name: 'small.jpg', metadata: { size: 1024 } },
        { name: 'big.jpg', metadata: { size: 5 * 1024 * 1024 } },
      ],
      error: null,
    })

    render(<StorageUsage />)

    await screen.findByText('용량 큰 파일 Top 10')
    const list = screen.getByText('용량 큰 파일 Top 10').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('big.jpg')
    expect(items[1]).toHaveTextContent('small.jpg')
  })

  it('파일이 없으면 안내 문구를 표시한다', async () => {
    mockList({ data: [], error: null })

    render(<StorageUsage />)

    await screen.findByText('파일이 없습니다.')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: { message: '권한 없음' } })
    supabase.storage.from.mockReturnValue({ list })

    render(<StorageUsage />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(list).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: FAIL — `Failed to resolve import "../admin/sections/StorageUsage"`

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageUsage.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  STORAGE_LIMIT_GB,
} from '../../../lib/storageUsage'

export default function StorageUsage() {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ files: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ files: null, loading: true, error: null })

    async function fetchFiles() {
      try {
        const files = await fetchAllStorageFiles((offset, limit) =>
          supabase.storage.from('media').list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
        )
        if (cancelled) return
        setState({ files, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ files: null, loading: false, error })
      }
    }

    fetchFiles()

    return () => { cancelled = true }
  }, [reloadToken])

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

  const files = state.files
  const usedBytes = totalBytes(files)
  const percent = usagePercent(usedBytes, STORAGE_LIMIT_GB)
  const largest = topLargestFiles(files, 10)

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
        <ul className="space-y-1">
          {largest.map(f => (
            <li key={f.name} className="flex justify-between text-sm border-b py-1">
              <span className="truncate">{f.name}</span>
              <span className="text-gray-500">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageUsage.jsx src/components/__tests__/StorageUsage.test.jsx
git commit -m "feat: 스토리지 사용량 관리자 화면 컴포넌트 추가"
```

---

### Task 5: `AdminDashboard`에 "스토리지 사용량" 메뉴 연결

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`
- Modify: `src/components/__tests__/AdminDashboard.test.jsx`

**Interfaces:**
- Consumes: `StorageUsage` (Task 4에서 정의, props 없음)

**현재 코드** (`src/components/admin/AdminDashboard.jsx`):
```js
import VisitorAnalytics from './sections/VisitorAnalytics'

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
  { key: 'analytics', label: '방문자 분석' },
  { key: 'account', label: '계정 설정' },
]

const NO_CONTENT_KEYS = ['account', 'analytics']
```
그리고 렌더링 부분:
```jsx
{activeKey === 'account' && <AccountForm />}
{activeKey === 'analytics' && <VisitorAnalytics />}
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/AdminDashboard.test.jsx` 상단 mock 목록에 `StorageUsage` mock을 추가하고, 파일 끝에 테스트를 하나 추가한다:

```js
vi.mock('../admin/sections/VisitorAnalytics', () => ({
  default: () => <div>방문자 분석 화면</div>,
}))
vi.mock('../admin/sections/StorageUsage', () => ({
  default: () => <div>스토리지 사용량 화면</div>,
}))
```

파일 마지막 `it(...)` 뒤에 추가:
```jsx
  it('스토리지 사용량 메뉴를 클릭하면 StorageUsage를 보여준다', () => {
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: '스토리지 사용량' }))

    expect(screen.getByText('스토리지 사용량 화면')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(useSectionContent).toHaveBeenCalledWith(null)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/AdminDashboard.test.jsx`
Expected: FAIL — `Unable to find role="button" with name "스토리지 사용량"` (메뉴가 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/AdminDashboard.jsx` 상단 import에 추가:
```js
import StorageUsage from './sections/StorageUsage'
```

`SECTIONS` 배열의 `analytics` 항목 뒤, `account` 항목 앞에 추가:
```js
  { key: 'analytics', label: '방문자 분석' },
  { key: 'storage', label: '스토리지 사용량' },
  { key: 'account', label: '계정 설정' },
```

`NO_CONTENT_KEYS`를 다음과 같이 수정:
```js
const NO_CONTENT_KEYS = ['account', 'analytics', 'storage']
```

렌더링 부분에 추가:
```jsx
{activeKey === 'account' && <AccountForm />}
{activeKey === 'analytics' && <VisitorAnalytics />}
{activeKey === 'storage' && <StorageUsage />}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/AdminDashboard.test.jsx`
Expected: PASS (전체 테스트, 신규 1건 포함)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminDashboard.jsx src/components/__tests__/AdminDashboard.test.jsx
git commit -m "feat: 관리자 메뉴에 스토리지 사용량 화면 연결"
```

---

### Task 6: DB 마이그레이션 — `storage.objects` 목록 조회 권한 (등급: 상 — 프로덕션 DB 변경, 사용자 확인 필수)

**Files:**
- Create: `supabase/update-storage-management.sql`

**배경**: `StorageUsage` 컴포넌트가 사용하는 `supabase.storage.from('media').list(...)`는 `storage.objects`에 대한 `SELECT` 권한이 필요하다. 기존 `supabase/update-security-hardening.sql`에서 익명(anon) 사용자의 목록 조회 권한을 보안상 제거했으므로(`Files > Buckets > media`가 `Public bucket`이어도 목록 조회는 별도 정책 필요), `authenticated` 역할에만 한정된 `SELECT` 정책을 새로 추가해야 관리자 화면에서 조회가 가능하다. 이 정책 없이는 `StorageUsage` 화면에서 "데이터를 불러오지 못했습니다" 에러가 뜬다.

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

`supabase/update-storage-management.sql`:
```sql
-- 스토리지 사용량 관리자 화면(StorageUsage)이 media 버킷의 파일 목록을 조회할 수 있도록 허용.
-- update-security-hardening.sql에서 익명(anon) 목록 조회만 제거했으므로,
-- authenticated로 범위를 한정해 다시 추가해도 원래 보안 강화 취지에 어긋나지 않는다.
create policy "media authenticated list" on storage.objects
  for select to authenticated using (bucket_id = 'media');
```

- [ ] **Step 2: 파일을 커밋한다 (아직 프로덕션에는 적용하지 않음)**

```bash
git add supabase/update-storage-management.sql
git commit -m "feat: 스토리지 사용량 조회용 authenticated SELECT 정책 마이그레이션 추가"
```

- [ ] **Step 3: 사용자에게 프로덕션 적용 여부를 확인한다**

이 단계부터는 실행 중인 세션(에이전트든 사용자 본인이든)이 **반드시 사용자에게 명시적으로 확인**을 받은 뒤에만 진행한다. 자동으로 실행하지 않는다.

확인 후, Supabase 대시보드(`https://supabase.com/dashboard/project/mjrfuktpqqqtvtbadxlj/sql/new`)의 SQL Editor에서 Step 1의 SQL을 직접 실행하거나, `supabase db push` 등 프로젝트에서 기존에 써온 방식(과거 `update-security-hardening.sql` 등을 적용했던 것과 동일한 절차)을 따라 적용한다.

- [ ] **Step 4: 배포된 사이트에서 동작 확인**

프로덕션 적용 후 `https://cos-profile.vercel.app/admin`에 로그인해 "스토리지 사용량" 메뉴를 클릭했을 때 에러 없이 총 사용량과 Top 10 목록이 표시되는지 확인한다. (이 확인은 브라우저 로그인이 필요하므로 사용자가 직접 하거나, 이미 로그인된 세션에서 관찰한다.)

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 "1. 한글 파일명 업로드 오류 수정" → Task 1, 2. "2. 스토리지 사용량 관리자 메뉴" → Task 3, 4, 5. "DB 마이그레이션" → Task 6. "에러 처리"(413 유지, 조회 실패 시 재시도 버튼) → Task 2/Step1, Task 4/Step1에 반영됨. "테스트 계획" 항목 전부 대응하는 테스트 파일 존재.
- **플레이스홀더 스캔**: TBD/TODO 없음. 모든 코드 블록에 실제 구현 포함.
- **타입/시그니처 일관성**: `buildUploadPath(fileName, timestamp?)`, `fetchAllStorageFiles(listPage, pageSize?)`, `totalBytes(files)`, `formatBytes(bytes)`, `usagePercent(bytes, limitGB)`, `topLargestFiles(files, limit?)` — Task 3에서 정의한 시그니처를 Task 4에서 그대로 사용함을 확인.
