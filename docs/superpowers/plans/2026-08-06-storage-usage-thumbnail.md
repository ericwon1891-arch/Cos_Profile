# 스토리지 사용량 화면 - 용량 큰 파일 썸네일 미리보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 화면의 "스토리지 사용량 > 용량 큰 파일 Top 10" 목록에서 각 파일이 어떤 사진인지 작은 썸네일로 바로 알아볼 수 있게 하고, 클릭하면 원본 이미지를 새 탭에서 볼 수 있게 한다.

**Architecture:** `media` 버킷이 public이므로 `supabase.storage.from('media').getPublicUrl(name)`을 렌더링 시점에 동기 호출해 public URL을 얻는다. 추가 API 호출, 상태, DB 변경 없이 `StorageUsage.jsx`의 Top 10 목록 렌더링 부분만 수정한다.

**Tech Stack:** React 19, Vite, Supabase JS(`@supabase/supabase-js`), Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-06-storage-usage-thumbnail-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 컴포넌트만 작성한다. Supabase 호출은 전부 mock 처리해 실제 네트워크 호출이 발생하지 않게 한다 (프로젝트 `CLAUDE.md` 테스트 원칙).
- 이번 작업은 로컬 코드/테스트 변경뿐이라(DB 마이그레이션 없음) 별도 확인 없이 진행 가능하다 (등급 **하**).

---

### Task 1: Top 10 목록에 썸네일 미리보기 + 원본 링크 추가

**Files:**
- Modify: `src/components/admin/sections/StorageUsage.jsx:75-86`
- Modify: `src/components/__tests__/StorageUsage.test.jsx`

**Interfaces:**
- Consumes: `supabase.storage.from('media').getPublicUrl(name: string)` → `{ data: { publicUrl: string } }` (Supabase JS 표준 API, 네트워크 호출 없이 동기적으로 URL 문자열만 조합해서 반환함)
- Produces: 변경 없음 (`export default function StorageUsage()`, props 없음 그대로 유지)

**현재 코드** (`src/components/admin/sections/StorageUsage.jsx:75-86`):
```jsx
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
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/StorageUsage.test.jsx`의 `mockList` 헬퍼를 `getPublicUrl`도 함께 mock하도록 수정하고, 파일 끝에 새 테스트를 추가한다.

`mockList` 헬퍼 교체:
```js
function mockList(result) {
  const list = vi.fn().mockResolvedValue(result)
  const getPublicUrl = vi.fn(path => ({
    data: { publicUrl: `https://example.com/storage/v1/object/public/media/${path}` },
  }))
  supabase.storage.from.mockReturnValue({ list, getPublicUrl })
  return list
}
```

파일 마지막 `it(...)` 뒤, `describe` 블록이 끝나기 전에 추가:
```jsx
  it('용량 큰 파일 항목에 썸네일 미리보기와 원본 링크를 표시한다', async () => {
    mockList({
      data: [{ name: 'big.jpg', metadata: { size: 5 * 1024 * 1024 } }],
      error: null,
    })

    render(<StorageUsage />)

    await screen.findByText('용량 큰 파일 Top 10')
    const img = screen.getByAltText('big.jpg')
    expect(img).toHaveAttribute(
      'src',
      'https://example.com/storage/v1/object/public/media/big.jpg'
    )

    const link = img.closest('a')
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/storage/v1/object/public/media/big.jpg'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: FAIL — 새 테스트에서 `getByAltText('big.jpg')`를 찾지 못함 (썸네일이 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/StorageUsage.jsx:75-86`를 다음으로 교체:
```jsx
      <h3 className="text-sm font-medium text-gray-700 mb-2">용량 큰 파일 Top 10</h3>
      {largest.length === 0 && <p className="text-sm text-gray-400">파일이 없습니다.</p>}
      {largest.length > 0 && (
        <ul className="space-y-1">
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/StorageUsage.test.jsx`
Expected: PASS (5개 테스트 전부 — 기존 4개 + 신규 1개)

- [ ] **Step 5: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/sections/StorageUsage.jsx src/components/__tests__/StorageUsage.test.jsx
git commit -m "feat: 스토리지 사용량 Top 10 목록에 썸네일 미리보기와 원본 링크 추가"
```

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 "썸네일 미리보기 추가", "클릭 시 새 탭으로 원본 열기", "fallback UI 없음(YAGNI)", "테스트 계획(src/getPublicUrl 및 href 검증)" 전부 Task 1에 반영됨.
- **플레이스홀더 스캔**: TBD/TODO 없음. 모든 코드 블록에 실제 구현 포함.
- **타입/시그니처 일관성**: `StorageUsage` 컴포넌트의 export 시그니처(props 없음)는 변경하지 않음. 기존 `formatBytes`, `topLargestFiles` 등 다른 유틸 함수 시그니처도 그대로 사용.
