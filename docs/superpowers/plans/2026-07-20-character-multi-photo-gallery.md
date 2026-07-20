# 캐릭터 다중 사진 갤러리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표 캐릭터 항목 하나에 여러 장의 사진을 올려서, 방문자가 모달에서 좌우로 넘겨볼 수 있게 한다.

**Architecture:** 캐릭터 데이터에 `photos: string[]` 필드를 추가해 `PhotoModal`이 배열을 순회하며 보여주도록 하고, 관리자 페이지의 공용 `ListField`에 opt-in 드래그 정렬 기능을 추가해 갤러리 사진 순서를 관리자가 조정할 수 있게 한다.

**Tech Stack:** React 18, Vite, Tailwind CSS, Vitest + @testing-library/react, Supabase JS (기존 스택 그대로, 신규 의존성 없음)

## Global Constraints

- 신규 의존성 추가 없음 — 네이티브 HTML5 Drag and Drop API만 사용 (스펙 "순서 드래그 정렬" 섹션)
- `type`이 `youtube`/`local`인 캐릭터 항목에는 다중 사진 기능을 적용하지 않는다 (스펙 "데이터 모델" 섹션)
- 모바일 터치 드래그 정렬은 지원하지 않는다 — 관리자 페이지는 데스크톱 전용 사용 전제 (스펙 "범위 밖" 섹션)
- `photos` 필드가 없거나 비어있는 기존 캐릭터 데이터는 `[work.src]`로 대체해 기존과 동일하게 동작해야 한다 — 마이그레이션 없음 (스펙 "데이터 모델" 섹션)
- 기존 `ListField` 사용처(카테고리, 링크 등)는 `reorderable` prop을 넘기지 않으므로 동작이 바뀌면 안 된다 (스펙 "순서 드래그 정렬" 섹션)

참고 스펙: `docs/superpowers/specs/2026-07-20-character-multi-photo-gallery-design.md`

---

### Task 1: PhotoModal 다중 사진 갤러리 내비게이션

**Files:**
- Modify: `src/components/PhotoModal.jsx`
- Test: `src/components/__tests__/PhotoModal.test.jsx`

**Interfaces:**
- Consumes: `work` prop 객체 — `{ id, title, src, photos? }`. `photos`는 optional `string[]`.
- Produces: 없음 (leaf 컴포넌트). `CharactersSection.jsx`(Task 2)가 이 컴포넌트를 그대로 사용.

- [ ] **Step 1: 기존 테스트 파일에 신규 테스트를 추가해 실패 상태로 만든다**

`src/components/__tests__/PhotoModal.test.jsx` 전체를 다음 내용으로 교체:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import PhotoModal from '../PhotoModal'

const photoWork = {
  id: 1,
  title: '테스트 사진',
  type: 'photo',
  src: '/photos/test.jpg',
}

const galleryWork = {
  id: 2,
  title: '갤러리 캐릭터',
  type: 'photo',
  src: '/photos/cover.jpg',
  photos: ['/photos/a.jpg', '/photos/b.jpg', '/photos/c.jpg'],
}

describe('PhotoModal', () => {
  it('사진을 렌더링한다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    const img = screen.getByAltText('테스트 사진')
    expect(img).toHaveAttribute('src', '/photos/test.jpg')
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<PhotoModal work={photoWork} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /닫기/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<PhotoModal work={photoWork} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('photos 필드가 없으면 화살표/카운터를 표시하지 않는다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    expect(screen.queryByLabelText('다음 사진')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이전 사진')).not.toBeInTheDocument()
  })

  it('photos가 여러 장이면 첫 사진과 카운터를 표시한다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/a.jpg')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('다음 사진 버튼 클릭 시 다음 사진으로 넘어간다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음 사진'))
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/b.jpg')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('첫 사진에서 이전 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByLabelText('이전 사진')).toBeDisabled()
  })

  it('마지막 사진에서 다음 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음 사진'))
    fireEvent.click(screen.getByLabelText('다음 사진'))
    expect(screen.getByLabelText('다음 사진')).toBeDisabled()
  })
})
```

- [ ] **Step 2: 테스트 실행해서 신규 테스트가 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/PhotoModal.test.jsx`
Expected: 기존 3개 테스트는 PASS, 신규 4개 테스트(`photos 필드가 없으면...`, `photos가 여러 장이면...`, `다음 사진 버튼...`, `첫 사진에서...`, `마지막 사진에서...`)는 FAIL — `getByLabelText('다음 사진')` 등을 찾지 못해서 에러

- [ ] **Step 3: PhotoModal.jsx를 다중 사진 지원하도록 구현**

`src/components/PhotoModal.jsx` 전체를 다음 내용으로 교체:

```jsx
import { useState } from 'react'

export default function PhotoModal({ work, onClose }) {
  const photos = work.photos?.length ? work.photos : [work.src].filter(Boolean)
  const [index, setIndex] = useState(0)
  const hasMultiple = photos.length > 1

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute -top-10 right-0 text-white text-xl hover:text-gray-300"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
        <img
          src={photos[index]}
          alt={work.title}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
        {hasMultiple && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="이전 사진"
            >
              ‹
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i + 1)}
              disabled={index === photos.length - 1}
              aria-label="다음 사진"
            >
              ›
            </button>
            <p className="text-center text-white text-sm mt-2">{index + 1} / {photos.length}</p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/PhotoModal.test.jsx`
Expected: 8개 테스트 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/PhotoModal.jsx src/components/__tests__/PhotoModal.test.jsx
git commit -m "feat: PhotoModal에 다중 사진 갤러리 좌우 탐색 추가"
```

---

### Task 2: CharactersSection에서 캐릭터가 바뀔 때 모달 상태 초기화

**Files:**
- Modify: `src/components/CharactersSection.jsx:46-48`

**Interfaces:**
- Consumes: Task 1에서 만든 `PhotoModal` (props 변경 없음, `key`만 추가)
- Produces: 없음

- [ ] **Step 1: PhotoModal 렌더링에 key prop 추가**

`src/components/CharactersSection.jsx`에서 아래 부분을 찾는다:

```jsx
      {selectedWork && selectedWork.type === 'photo' && (
        <PhotoModal work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
```

다음으로 교체:

```jsx
      {selectedWork && selectedWork.type === 'photo' && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
```

**이유:** `PhotoModal`은 내부에서 `useState`로 현재 사진 인덱스를 관리한다(Task 1). 캐릭터 A의 3번째 사진을 보다가 모달을 닫고 캐릭터 B를 열면, React가 같은 `PhotoModal` 엘리먼트를 재사용해 인덱스 상태가 그대로 남아있을 수 있다. `key={selectedWork.id}`를 주면 캐릭터가 바뀔 때마다 컴포넌트가 새로 마운트되어 인덱스가 0으로 초기화된다.

- [ ] **Step 2: 기존 테스트가 여전히 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharactersSection.test.jsx`
Expected: 6개 테스트 전부 PASS (동작 변화 없음, 회귀 확인용)

- [ ] **Step 3: 커밋**

```bash
git add src/components/CharactersSection.jsx
git commit -m "fix: 캐릭터 전환 시 PhotoModal 사진 인덱스 초기화"
```

---

### Task 3: ListField에 opt-in 드래그 순서 정렬 추가

**Files:**
- Modify: `src/components/admin/fields/ListField.jsx`
- Test: `src/components/__tests__/ListField.test.jsx` (신규 생성)

**Interfaces:**
- Consumes: 없음
- Produces: `ListField` 컴포넌트에 신규 optional prop `reorderable: boolean` (기본값 `false`). `reorderable`이 없거나 `false`이면 기존 동작과 100% 동일. Task 4에서 `reorderable` prop을 사용.

- [ ] **Step 1: 신규 테스트 파일 작성**

`src/components/__tests__/ListField.test.jsx` 생성:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import ListField from '../admin/fields/ListField'

function renderTextItem({ item, index, onChange }) {
  return (
    <input
      aria-label={`item-${index}`}
      value={item}
      onChange={e => onChange(index, e.target.value)}
    />
  )
}

describe('ListField', () => {
  it('reorderable이 아니면 드래그 핸들을 표시하지 않는다', () => {
    render(
      <ListField
        label="목록"
        items={['a', 'b']}
        onChange={() => {}}
        newItem=""
        renderItem={renderTextItem}
      />
    )
    expect(screen.queryByLabelText('드래그해서 순서 변경')).not.toBeInTheDocument()
  })

  it('reorderable이면 드래그 핸들을 표시한다', () => {
    render(
      <ListField
        label="목록"
        items={['a', 'b']}
        onChange={() => {}}
        newItem=""
        renderItem={renderTextItem}
        reorderable
      />
    )
    expect(screen.getAllByLabelText('드래그해서 순서 변경')).toHaveLength(2)
  })

  it('드래그해서 항목 순서를 옮기면 onChange가 새 순서로 호출된다', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ListField
        label="목록"
        items={['a', 'b', 'c']}
        onChange={onChange}
        newItem=""
        renderItem={renderTextItem}
        reorderable
      />
    )
    const rows = container.querySelectorAll('[draggable="true"]')
    fireEvent.dragStart(rows[2])
    fireEvent.dragOver(rows[0])
    fireEvent.drop(rows[0])
    expect(onChange).toHaveBeenCalledWith(['c', 'a', 'b'])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/ListField.test.jsx`
Expected: 3개 테스트 전부 FAIL — `reorderable` prop이 아직 없어서 드래그 핸들이 렌더링되지 않음

- [ ] **Step 3: ListField.jsx에 reorderable 구현**

`src/components/admin/fields/ListField.jsx` 전체를 다음 내용으로 교체:

```jsx
import { useState } from 'react'

export default function ListField({ label, items, onChange, renderItem, addLabel = '항목 추가', newItem, reorderable = false }) {
  const [dragIndex, setDragIndex] = useState(null)

  function updateItem(index, newValue) {
    const next = [...items]
    next[index] = newValue
    onChange(next)
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    onChange([...items, newItem])
  }

  function handleDrop(dropIndex) {
    if (dragIndex === null || dragIndex === dropIndex) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    onChange(next)
    setDragIndex(null)
  }

  return (
    <div className="mb-6">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={`border border-gray-200 rounded p-3 relative ${reorderable ? 'pl-8' : ''}`}
            draggable={reorderable}
            onDragStart={reorderable ? () => setDragIndex(index) : undefined}
            onDragOver={reorderable ? e => e.preventDefault() : undefined}
            onDrop={reorderable ? () => handleDrop(index) : undefined}
          >
            {reorderable && (
              <span
                className="absolute top-2 left-2 cursor-grab text-gray-400 text-sm select-none"
                aria-label="드래그해서 순서 변경"
                title="드래그해서 순서 변경"
              >
                ⠿
              </span>
            )}
            {renderItem({ item, index, onChange: updateItem, onRemove: removeItem })}
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="absolute top-2 right-2 text-red-500 text-xs hover:underline"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-3 text-sm text-blue-600 hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/ListField.test.jsx`
Expected: 3개 테스트 전부 PASS

- [ ] **Step 5: 전체 테스트 스위트 실행해서 다른 ListField 사용처(카테고리, 링크 등)가 깨지지 않았는지 확인**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS (기존 테스트 개수 + 신규 8개(PhotoModal 5개 추가분) + 3개(ListField) 만큼 증가)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/fields/ListField.jsx src/components/__tests__/ListField.test.jsx
git commit -m "feat: ListField에 opt-in 드래그 순서 정렬(reorderable) 추가"
```

---

### Task 4: CharactersForm에 갤러리 사진 목록 연결

**Files:**
- Modify: `src/components/admin/sections/CharactersForm.jsx`

**Interfaces:**
- Consumes: Task 3의 `ListField`(`reorderable` prop), 기존 `ImageField`(`hint` prop, 이미 존재)
- Produces: 캐릭터 데이터에 `photos: string[]` 필드를 채워서 `onSave`로 전달 → Task 1의 `PhotoModal`이 소비하는 필드와 일치

- [ ] **Step 1: CharactersForm.jsx 수정**

`src/components/admin/sections/CharactersForm.jsx`에서 아래 블록을 찾는다:

```jsx
        newItem={{ id: Date.now(), title: '', category: form.categories[1] ?? '', type: 'photo', src: '', thumbnail: '' }}
        addLabel="캐릭터 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="캐릭터/작품명" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextField label="카테고리" value={item.category} onChange={v => onChange(index, { ...item, category: v })} />
            <TextField label="타입 (photo/youtube/local)" value={item.type} onChange={v => onChange(index, { ...item, type: v })} />
            <ImageField
              label="사진"
              value={item.thumbnail}
              onChange={v => onChange(index, { ...item, thumbnail: v, src: item.type === 'photo' ? v : item.src })}
              hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
            />
            <TextField label="YouTube 영상 ID (type이 youtube일 때)" value={item.youtubeId || ''} onChange={v => onChange(index, { ...item, youtubeId: v })} />
            <TextField label="영상 파일 URL (type이 local일 때)" value={item.src} onChange={v => onChange(index, { ...item, src: v })} />
          </>
        )}
```

다음으로 교체:

```jsx
        newItem={{ id: Date.now(), title: '', category: form.categories[1] ?? '', type: 'photo', src: '', thumbnail: '', photos: [] }}
        addLabel="캐릭터 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="캐릭터/작품명" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextField label="카테고리" value={item.category} onChange={v => onChange(index, { ...item, category: v })} />
            <TextField label="타입 (photo/youtube/local)" value={item.type} onChange={v => onChange(index, { ...item, type: v })} />
            <ImageField
              label="사진 (카드 대표 사진)"
              value={item.thumbnail}
              onChange={v => onChange(index, { ...item, thumbnail: v, src: item.type === 'photo' ? v : item.src })}
              hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
            />
            <ListField
              label="갤러리 사진 (타입이 photo일 때만 사용됨, 모달에서 넘겨보는 사진들 — 대표 사진과 별개, 대표 사진도 보이게 하려면 여기에 한 번 더 추가)"
              items={item.photos ?? []}
              onChange={photos => onChange(index, { ...item, photos })}
              newItem=""
              addLabel="갤러리 사진 추가"
              reorderable
              renderItem={({ item: photoUrl, index: photoIndex, onChange: onPhotoChange }) => (
                <ImageField
                  label={`사진 ${photoIndex + 1}`}
                  value={photoUrl}
                  onChange={v => onPhotoChange(photoIndex, v)}
                  hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
                />
              )}
            />
            <TextField label="YouTube 영상 ID (type이 youtube일 때)" value={item.youtubeId || ''} onChange={v => onChange(index, { ...item, youtubeId: v })} />
            <TextField label="영상 파일 URL (type이 local일 때)" value={item.src} onChange={v => onChange(index, { ...item, src: v })} />
          </>
        )}
```

- [ ] **Step 2: 전체 테스트 스위트 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 PASS (CharactersForm 자체는 테스트 파일이 없으므로 회귀 없음 — 스펙의 "테스트 계획"에서 이 파일은 수동 검증으로 명시됨)

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공 (`dist/` 산출)

- [ ] **Step 4: 커밋**

```bash
git add src/components/admin/sections/CharactersForm.jsx
git commit -m "feat: 캐릭터 관리자 폼에 갤러리 사진 목록(드래그 순서 정렬 포함) 추가"
```

---

### Task 5: 통합 검증

**Files:** 없음 (코드 변경 없음, 검증만)

- [ ] **Step 1: 전체 테스트 스위트 최종 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS, 실패 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 3: 수동 브라우저 검증 (Playwright 또는 `npm run preview`)**

`npm run preview`로 로컬 서버를 띄우고 실제 로그인 세션으로 관리자 페이지의 캐릭터 편집 폼에서:
1. 캐릭터 하나에 "갤러리 사진"을 2~3장 추가
2. 드래그 핸들(⠿)로 순서를 바꿔서 저장
3. 공개 홈페이지에서 해당 캐릭터 카드를 클릭 → 좌우 화살표로 사진이 저장한 순서대로 넘어가는지, 카운터가 맞는지 확인
4. `photos`가 없는 기존(레거시) 캐릭터를 클릭 → 화살표/카운터 없이 사진 한 장만 보이는지 확인 (하위 호환)

이 Step은 커밋 대상 코드 변경이 없으므로 git 커밋 없음.
