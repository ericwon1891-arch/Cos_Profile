# 미사용 파일 일괄 정리 + 휴지통 비우기 버튼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "전체 파일 보기"에 미사용 파일 전체를 한 번에 휴지통으로 보내는 버튼을, 휴지통에 전체를 한 번에 영구 삭제하는 버튼을 추가한다.

**Architecture:** 두 버튼 모두 기존 `onDelete`/`describeStorageActionError`/`moveFiles` 패턴을 재사용한다. 새 상태나 API 패턴을 도입하지 않는다.

**Tech Stack:** React 19, Vite, Supabase JS(`@supabase/supabase-js`), Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-06-storage-bulk-cleanup-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 컴포넌트만 작성한다. Supabase 호출은 전부 mock 처리한다.
- 각 작업 단위가 끝날 때마다 커밋한다.
- 전부 로컬 코드/테스트 변경뿐이라(DB 마이그레이션 없음, 기존 이동/삭제 RLS 정책 재사용) 별도 확인 없이 진행 가능하다 (등급 **하**).

---

### Task 1: `StorageFileList`에 "미사용 파일 정리(N)" 버튼 추가

**Files:**
- Modify: `src/components/admin/sections/StorageFileList.jsx`
- Modify: `src/components/__tests__/StorageFileList.test.jsx`

**Interfaces:**
- Consumes: 기존 `onDelete(names: string[])` 그대로 재사용 (새 prop 없음)
- Produces: 변경 없음

**현재 코드** (`src/components/admin/sections/StorageFileList.jsx:5-34`):
```jsx
export default function StorageFileList({ files, usedPaths = new Set(), onDelete }) {
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
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageFileList.test.jsx` 파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('미사용 파일이 없으면 "미사용 파일 정리" 버튼이 보이지 않는다', () => {
    mockGetPublicUrl()
    render(
      <StorageFileList
        files={[{ name: 'used.jpg', size: 1024 }]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /미사용 파일 정리/ })).not.toBeInTheDocument()
  })

  it('"미사용 파일 정리(N)" 버튼을 클릭+확인하면 미사용 파일 전체로 onDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn().mockResolvedValue()

    render(
      <StorageFileList
        files={[
          { name: 'used.jpg', size: 1024 },
          { name: 'orphan1.jpg', size: 1024 },
          { name: 'orphan2.jpg', size: 1024 },
        ]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '미사용 파일 정리(2)' }))

    expect(confirmSpy).toHaveBeenCalledWith('미사용 파일 2개를 휴지통으로 이동할까요?')
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(['orphan1.jpg', 'orphan2.jpg']))

    confirmSpy.mockRestore()
  })

  it('"미사용 파일 정리" 확인 대화상자에서 취소하면 onDelete를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()

    render(<StorageFileList files={[{ name: 'orphan.jpg', size: 1024 }]} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: '미사용 파일 정리(1)' }))

    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: FAIL — "미사용 파일 정리" 버튼을 찾지 못함

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageFileList.jsx`의 함수 본문을 다음으로 교체:
```jsx
export default function StorageFileList({ files, usedPaths = new Set(), onDelete }) {
  const [selected, setSelected] = useState([])
  const unusedNames = files.filter(f => !usedPaths.has(f.name)).map(f => f.name)

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

  async function handleCleanupUnusedClick() {
    if (!confirm(`미사용 파일 ${unusedNames.length}개를 휴지통으로 이동할까요?`)) return
    await onDelete(unusedNames)
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
          className="mb-2 mr-2 text-sm text-red-600 underline"
        >
          선택 삭제({selected.length})
        </button>
      )}
      {unusedNames.length > 0 && (
        <button
          type="button"
          onClick={handleCleanupUnusedClick}
          className="mb-2 text-sm text-orange-600 underline"
        >
          미사용 파일 정리({unusedNames.length})
        </button>
      )}
```
(이후 `<ul>...</ul>` 부분은 변경 없음)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageFileList.test.jsx`
Expected: PASS (9개 — 기존 6개 + 신규 3개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageFileList.jsx src/components/__tests__/StorageFileList.test.jsx
git commit -m "feat: StorageFileList에 미사용 파일 일괄 정리 버튼 추가"
```

---

### Task 2: `StorageTrash`에 "휴지통 비우기" 버튼 추가

**Files:**
- Modify: `src/components/admin/sections/StorageTrash.jsx`
- Modify: `src/components/__tests__/StorageTrash.test.jsx`

**Interfaces:**
- Consumes: 없음
- Produces: `export default function StorageTrash({ files, onRestore, onPermanentDelete, onEmptyTrash: () => Promise<void> })` — `onEmptyTrash` prop 추가

**현재 코드** (`src/components/admin/sections/StorageTrash.jsx:4-15`):
```jsx
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
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageTrash.test.jsx` 파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('"휴지통 비우기" 버튼을 클릭+확인하면 onEmptyTrash를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onEmptyTrash = vi.fn().mockResolvedValue()

    render(
      <StorageTrash
        files={[
          { name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() },
          { name: 'trash/b.jpg', size: 1024, updatedAt: new Date().toISOString() },
        ]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyTrash={onEmptyTrash}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    expect(confirmSpy).toHaveBeenCalledWith('휴지통의 파일 2개를 전부 영구 삭제할까요? 되돌릴 수 없습니다.')
    await waitFor(() => expect(onEmptyTrash).toHaveBeenCalled())

    confirmSpy.mockRestore()
  })

  it('"휴지통 비우기" 확인 대화상자에서 취소하면 onEmptyTrash를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onEmptyTrash = vi.fn()

    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyTrash={onEmptyTrash}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    expect(onEmptyTrash).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageTrash.test.jsx`
Expected: FAIL — "휴지통 비우기" 버튼을 찾지 못함

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageTrash.jsx`를 다음으로 교체:
```jsx
export default function StorageTrash({ files, onRestore, onPermanentDelete, onEmptyTrash }) {
  if (files.length === 0) {
    return <p className="text-sm text-gray-400">휴지통이 비어 있습니다.</p>
  }

  async function handlePermanentDeleteClick(name) {
    if (!confirm('이 파일을 지금 영구 삭제할까요? 되돌릴 수 없습니다.')) return
    await onPermanentDelete(name)
  }

  async function handleEmptyTrashClick() {
    if (!confirm(`휴지통의 파일 ${files.length}개를 전부 영구 삭제할까요? 되돌릴 수 없습니다.`)) return
    await onEmptyTrash()
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleEmptyTrashClick}
        className="mb-2 text-sm text-red-600 underline"
      >
        휴지통 비우기
      </button>
      <ul className="space-y-1">
```
(`<ul>` 내부와 마지막 닫는 `</ul>` 이후 `</div>\n)` 로 감싸는 것 외에는 변경 없음 — 기존 `</ul>\n)`를 `</ul>\n    </div>\n  )`로 교체)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageTrash.test.jsx`
Expected: PASS (6개 — 기존 4개 + 신규 2개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/StorageTrash.jsx src/components/__tests__/StorageTrash.test.jsx
git commit -m "feat: StorageTrash에 휴지통 비우기 버튼 추가"
```

---

### Task 3: `StorageUsage` 컨테이너에 `handleEmptyTrash` 연결

**Files:**
- Modify: `src/components/admin/sections/StorageUsage.jsx`
- Modify: `src/components/__tests__/StorageUsage.test.jsx`

**Interfaces:**
- Consumes: `StorageTrash`의 `onEmptyTrash` prop (Task 2)
- Produces: 변경 없음

**현재 코드** (`src/components/admin/sections/StorageUsage.jsx:91-98`):
```js
  async function handlePermanentDelete(trashName) {
    const { error } = await supabase.storage.from('media').remove([trashName])
    if (error) {
      alert(`작업 실패: ${describeStorageActionError(error)}`)
      return
    }
    setReloadToken(t => t + 1)
  }
```
그리고 렌더링부(`src/components/admin/sections/StorageUsage.jsx:180-184`):
```jsx
      <StorageTrash
        files={trashList}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageUsage.test.jsx` 파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('"휴지통 비우기"를 클릭하면 휴지통의 모든 파일을 한 번에 영구 삭제한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { remove } = mockStorage({
      trash: [
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
        { id: '2', name: 'b.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
      ],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '휴지통 비우기' }))
    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(expect.arrayContaining(['trash/a.jpg', 'trash/b.jpg']))
    )
    confirmSpy.mockRestore()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: FAIL — "휴지통 비우기" 버튼을 찾지 못함(StorageTrash에 `onEmptyTrash`가 아직 연결 안 됨)

- [ ] **Step 3: 최소 구현 작성**

`handlePermanentDelete` 함수 뒤에 추가:
```js
  async function handleEmptyTrash() {
    const names = state.trashFiles.map(f => f.name)
    const { error } = await supabase.storage.from('media').remove(names)
    if (error) {
      alert(`작업 실패: ${describeStorageActionError(error)}`)
      return
    }
    setReloadToken(t => t + 1)
  }
```

`<StorageTrash ... />` 렌더링 부분을 다음으로 교체:
```jsx
      <StorageTrash
        files={trashList}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
      />
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: PASS (전체 — 기존 12개 + 신규 1개 = 13개)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/sections/StorageUsage.jsx src/components/__tests__/StorageUsage.test.jsx
git commit -m "feat: 스토리지 사용량 화면에 휴지통 비우기 연결"
```

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 두 버튼(미사용 파일 정리 / 휴지통 비우기) 전부 Task 1/2/3에 반영됨. "기존 인터페이스 재사용" 원칙(onDelete 재사용, describeStorageActionError 재사용) 그대로 구현.
- **플레이스홀더 스캔**: TBD/TODO 없음.
- **타입/시그니처 일관성**: `StorageTrash`의 새 prop `onEmptyTrash`가 Task 2 정의와 Task 3 사용부에서 일치. `StorageFileList`는 새 prop 없이 기존 `onDelete` 재사용.
