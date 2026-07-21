# 캐릭터 카드 그리드 "더보기" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `CharacterSectionBlock`의 카드 그리드가 필터링된 캐릭터 6개까지만 우선 보여주고, 6개를 넘으면 "더보기" 버튼으로 나머지를 한 번에 펼칠 수 있게 한다.

**Architecture:** `CharacterSectionBlock`에 `expanded` boolean state를 추가해 `filtered.slice(0, 6)` vs 전체 중 무엇을 그리드에 렌더링할지 결정한다. 카테고리 필터를 바꾸는 클릭 핸들러에서 `expanded`를 함께 `false`로 리셋한다.

**Tech Stack:** React 18, Vite, Tailwind CSS, Vitest + @testing-library/react — 신규 의존성 없음

참고 스펙: `docs/superpowers/specs/2026-07-22-character-card-show-more-design.md`

## Global Constraints

- 신규 의존성 추가 없음
- 페이지네이션(여러 단계로 나눠 추가 로드) 하지 않는다 — "더보기"는 한 번에 나머지 전부를 펼친다 (스펙 "Non-goals")
- 별도의 재사용 컴포넌트로 분리하지 않는다 — `CharacterSectionBlock.jsx` 안에서만 처리 (스펙 "Non-goals")
- 필터링된 카드가 6개 이하일 때는 자르기도, 버튼 표시도 하지 않는다 (지금과 동일하게 동작)

---

### Task 1: `CharacterSectionBlock`에 더보기 기능 추가

**Files:**
- Modify: `src/components/CharacterSectionBlock.jsx`
- Modify: `src/components/__tests__/CharacterSectionBlock.test.jsx`

**Interfaces:**
- Consumes: 기존과 동일한 `section` prop (`{ id, heading, categories, items }`) — 형태 변경 없음
- Produces: 없음 (leaf 컴포넌트, 다른 컴포넌트가 이 파일을 참조하는 방식 변경 없음)

- [ ] **Step 1: 테스트 파일에 더보기 관련 케이스 추가 (실패 상태로 만듦)**

`src/components/__tests__/CharacterSectionBlock.test.jsx`에서 `mockSection` 선언 바로 다음, `describe('CharacterSectionBlock', ...)` 앞에 새 mock을 추가:

```jsx
const manyItemsSection = {
  id: 'video',
  heading: '대표 캐릭터 - 영상',
  categories: ['전체', '카테고리 A', '카테고리 B'],
  items: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    title: `캐릭터 ${i + 1}`,
    category: i < 7 ? '카테고리 A' : '카테고리 B',
    type: 'photo',
    src: `/p${i + 1}.jpg`,
    thumbnail: `/p${i + 1}.jpg`,
  })),
}
```

그리고 `describe` 블록의 마지막 `it` 다음, 닫는 `})` 앞에 아래 4개 테스트를 추가:

```jsx
  it('필터링된 카드가 6개 이하면 더보기 버튼이 없다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
  })

  it('필터링된 카드가 7개 이상이면 처음엔 6개만 표시되고 더보기 버튼이 보인다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument()
  })

  it('더보기 클릭 시 나머지 카드가 모두 표시되고 버튼이 사라진다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    fireEvent.click(screen.getByRole('button', { name: '더보기' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
  })

  it('펼쳐진 상태에서 다른 카테고리로 필터를 바꾸면 다시 6개로 접힌 상태로 시작한다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    fireEvent.click(screen.getByRole('button', { name: '더보기' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 A' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: 기존 7개는 PASS, 신규 4개 중 "7개 이상" 케이스는 `getAllByTestId('work-card')`가 8개를 반환해서 `toHaveLength(6)` 실패, "더보기 버튼" 관련 케이스들은 `getByRole('button', { name: '더보기' })`를 찾지 못해 실패

- [ ] **Step 3: `CharacterSectionBlock.jsx`에 더보기 로직 구현**

`src/components/CharacterSectionBlock.jsx` 전체를 다음으로 교체:

```jsx
import { useState } from 'react'
import WorkCard from './WorkCard'
import PhotoModal from './PhotoModal'

const VISIBLE_COUNT = 6

export default function CharacterSectionBlock({ section }) {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [selectedWork, setSelectedWork] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const { id, heading, categories, items } = section
  const filtered = activeFilter === '전체'
    ? items
    : items.filter(item => item.category === activeFilter)

  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_COUNT)

  function handleFilterClick(category) {
    setActiveFilter(category)
    setExpanded(false)
  }

  return (
    <section id={`characters-${id}`} className="py-20 bg-[#f9f9f7]">
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
            <WorkCard key={item.id} work={item} onClick={setSelectedWork} />
          ))}
        </div>
        {filtered.length > VISIBLE_COUNT && !expanded && (
          <div className="text-center mt-8">
            <button
              onClick={() => setExpanded(true)}
              className="px-6 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:border-gray-500"
            >
              더보기
            </button>
          </div>
        )}
      </div>
      {selectedWork && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
    </section>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: 11개 테스트 전부 PASS

- [ ] **Step 5: 전체 테스트 스위트 실행 (다른 곳에 영향 없는지 확인)**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS (`CharactersSection.test.jsx`는 `CharacterSectionBlock`을 mock하므로 영향 없음, `Navbar.test.jsx`도 무관)

- [ ] **Step 6: 커밋**

```bash
git add src/components/CharacterSectionBlock.jsx src/components/__tests__/CharacterSectionBlock.test.jsx
git commit -m "feat: 캐릭터 카드가 6개 넘으면 더보기 버튼으로 나머지를 펼치도록 추가"
```

---

### Task 2: 통합 검증

**Files:** 없음 (코드 변경 없음, 검증만)

- [ ] **Step 1: 프로덕션 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 2: 수동 브라우저 검증**

`npm run dev`로 로컬 서버를 띄우고 공개 홈페이지의 "대표 캐릭터 - 영상" 섹션(캐릭터 4개, 6개 이하)에서:
1. 더보기 버튼이 안 보이고 캐릭터 전부가 그대로 보이는지 확인 (6개 이하라 이 데이터로는 잘림 동작을 직접 볼 수 없음 — 확인 목적은 "회귀 없음"임)
2. 관리자 페이지에서 캐릭터를 7개 이상으로 늘려 저장한 뒤, 공개 페이지에서 6개만 보이고 "더보기" 버튼이 나타나는지, 클릭 시 전부 펼쳐지는지 확인

이 스텝은 커밋 대상 코드 변경이 없으므로 git 커밋 없음.
