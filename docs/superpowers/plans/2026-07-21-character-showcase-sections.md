# 대표 캐릭터 — 사진/영상 섹션 분리 및 다중 섹션화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하나로 합쳐진 "대표 캐릭터" 섹션을, 관리자가 자유롭게 추가/삭제/순서변경할 수 있는 여러 개의 독립된 "캐릭터 쇼케이스 섹션"으로 바꾼다. 기존 캐릭터 데이터는 영상 유무 기준으로 "사진" 섹션과 "영상" 섹션 두 개로 자동 마이그레이션한다.

**Architecture:** `site_content.section='characters'`의 `data`를 `{ heading, categories, items }` 단일 객체에서 `{ sections: [{id, heading, categories, items}, ...] }` 배열로 바꾼다. 공개 페이지는 섹션별 렌더링을 새 컴포넌트 `CharacterSectionBlock`으로 추출하고, `CharactersSection`은 그 배열을 순회하는 얇은 컨테이너가 된다. `Navbar`는 같은 데이터를 읽어 섹션마다 네비게이션 항목을 동적으로 만든다. 관리자 폼은 기존 카테고리/캐릭터 `ListField`를 섹션 단위 `ListField`로 한 겹 더 감싼다.

**Tech Stack:** React 18, Vite, Tailwind CSS, Vitest + @testing-library/react, Supabase (PostgreSQL jsonb) — 신규 의존성 없음

참고 스펙: `docs/superpowers/specs/2026-07-21-character-showcase-sections-design.md`

## Global Constraints

- 신규 의존성 추가 없음
- `CharacterItem`(캐릭터 개별 아이템) 필드는 변경하지 않는다 — `title`/`category`/`thumbnail`/`photos`/`youtubeId`/`youtubeStart`/`localVideoSrc`/레거시 `type`/`src` 그대로 유지, PhotoModal의 사진+영상 슬라이드 통합 로직도 변경 없음 (스펙 "Non-goals")
- `CharactersForm.jsx`는 이 코드베이스 관례대로 전용 테스트 파일을 두지 않고, 전체 테스트 스위트 + `npm run build`로 검증한다 (스펙 "테스트" 섹션, 기존 `2026-07-21-character-mixed-media-gallery.md` 계획의 Task 4와 동일한 관례)
- 마이그레이션 SQL(`supabase/update-characters-sections.sql`)은 실제 운영 Supabase DB에 적용되는 변경이므로, 에릭의 명시적 확인 없이 절대 자동 실행하지 않는다 — Task 6에서 확인 게이트를 거친다

---

### Task 1: `CharacterSectionBlock` 컴포넌트 추출

**Files:**
- Create: `src/components/CharacterSectionBlock.jsx`
- Create: `src/components/__tests__/CharacterSectionBlock.test.jsx`

**Interfaces:**
- Consumes: `section` prop — `{ id: string|number, heading: string, categories: string[], items: CharacterItem[] }` (CharacterItem 필드는 기존과 동일). 기존 `WorkCard`(`work`/`onClick` props, `data-testid="work-card"`)와 `PhotoModal`(`work`/`onClose` props)을 그대로 사용
- Produces: default export `CharacterSectionBlock`. 렌더링되는 `<section>`의 `id` 속성은 `characters-${section.id}` 형태 — Task 3(Navbar)이 만드는 앵커 링크가 이 id와 정확히 일치해야 함

- [x] **Step 1: 테스트 파일 작성 (실패 상태)**

`src/components/__tests__/CharacterSectionBlock.test.jsx` 신규 작성:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import CharacterSectionBlock from '../CharacterSectionBlock'

const mockSection = {
  id: 'photo',
  heading: '대표 캐릭터 - 사진',
  categories: ['전체', '카테고리 1', '카테고리 2'],
  items: [
    { id: 1, title: '캐릭터 1', category: '카테고리 1', type: 'photo', src: '/p1.jpg', thumbnail: '/p1.jpg' },
    { id: 2, title: '캐릭터 2', category: '카테고리 1', type: 'photo', src: '/p2.jpg', thumbnail: '/p2.jpg' },
    { id: 3, title: '캐릭터 3', category: '카테고리 2', type: 'youtube', youtubeId: 'abc', thumbnail: '/p3.jpg' },
  ],
}

describe('CharacterSectionBlock', () => {
  it('섹션 제목을 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.getByText('대표 캐릭터 - 사진')).toBeInTheDocument()
  })

  it('섹션 id를 앵커로 갖는다', () => {
    const { container } = render(<CharacterSectionBlock section={mockSection} />)
    expect(container.querySelector('#characters-photo')).toBeInTheDocument()
  })

  it('기본은 전체 캐릭터를 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('카테고리 1 필터 클릭 시 해당 카테고리만 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 1' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(2)
  })

  it('전체 필터 클릭 시 모든 캐릭터를 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 1' }))
    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('photo 타입 카드 클릭 시 PhotoModal이 열린다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])
    expect(screen.getAllByAltText('캐릭터 1')).toHaveLength(2)
  })

  it('youtube 타입 카드 클릭 시 모달에 영상 슬라이드가 열린다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[2])
    expect(screen.getByTitle('video-player')).toBeInTheDocument()
  })
})
```

- [x] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: FAIL — `../CharacterSectionBlock` 모듈을 찾을 수 없다는 에러

- [x] **Step 3: `CharacterSectionBlock.jsx` 작성**

`src/components/CharacterSectionBlock.jsx` 신규 작성 (기존 `CharactersSection.jsx`의 렌더링 로직을 `section` prop 기반으로 이식):

```jsx
import { useState } from 'react'
import WorkCard from './WorkCard'
import PhotoModal from './PhotoModal'

export default function CharacterSectionBlock({ section }) {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [selectedWork, setSelectedWork] = useState(null)

  const { id, heading, categories, items } = section
  const filtered = activeFilter === '전체'
    ? items
    : items.filter(item => item.category === activeFilter)

  return (
    <section id={`characters-${id}`} className="py-20 bg-[#f9f9f7]">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <div className="flex gap-3 justify-center mb-10 flex-wrap">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveFilter(category)}
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
          {filtered.map(item => (
            <WorkCard key={item.id} work={item} onClick={setSelectedWork} />
          ))}
        </div>
      </div>
      {selectedWork && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
    </section>
  )
}
```

- [x] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharacterSectionBlock.test.jsx`
Expected: 7개 테스트 전부 PASS

- [x] **Step 5: 커밋**

```bash
git add src/components/CharacterSectionBlock.jsx src/components/__tests__/CharacterSectionBlock.test.jsx
git commit -m "feat: 캐릭터 섹션 렌더링을 CharacterSectionBlock 컴포넌트로 추출"
```

---

### Task 2: `CharactersSection`을 다중 섹션 컨테이너로 축소

**Files:**
- Modify: `src/components/CharactersSection.jsx`
- Modify: `src/components/__tests__/CharactersSection.test.jsx` (전체 교체)

**Interfaces:**
- Consumes: `useSectionContent('characters')` — 반환되는 `data`가 이제 `{ sections: [...] }` 형태라고 가정. Task 1의 `CharacterSectionBlock`(props: `section`)
- Produces: 없음 (leaf 진입점, `App.jsx` 등에서 `<CharactersSection />`으로 그대로 사용 — 사용법 변경 없음)

- [x] **Step 1: 테스트 파일을 다음 내용으로 전체 교체 (실패 상태로 만듦)**

`src/components/__tests__/CharactersSection.test.jsx` 전체를 다음으로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import CharactersSection from '../CharactersSection'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

vi.mock('../CharacterSectionBlock', () => ({
  default: ({ section }) => <div data-testid="section-block">{section.heading}</div>,
}))

describe('CharactersSection', () => {
  it('섹션 배열 순서대로 CharacterSectionBlock을 렌더링한다', () => {
    useSectionContent.mockReturnValue({
      data: {
        sections: [
          { id: 'photo', heading: '대표 캐릭터 - 사진', categories: [], items: [] },
          { id: 'video', heading: '대표 캐릭터 - 영상', categories: [], items: [] },
        ],
      },
      loading: false,
      error: null,
    })
    render(<CharactersSection />)
    const blocks = screen.getAllByTestId('section-block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toHaveTextContent('대표 캐릭터 - 사진')
    expect(blocks[1]).toHaveTextContent('대표 캐릭터 - 영상')
  })

  it('섹션이 빈 배열이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: { sections: [] }, loading: false, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })

  it('로딩 중이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })

  it('data가 null이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: false, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })
})
```

- [x] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharactersSection.test.jsx`
Expected: FAIL — 기존 `CharactersSection.jsx`가 아직 `{heading, categories, items}` 형태를 기대하고 `data.sections`가 없어 `filtered`/`map` 관련 에러 또는 렌더링 불일치로 실패

- [x] **Step 3: `CharactersSection.jsx`를 컨테이너로 교체**

`src/components/CharactersSection.jsx` 전체를 다음으로 교체:

```jsx
import { useSectionContent } from '../hooks/useSectionContent'
import CharacterSectionBlock from './CharacterSectionBlock'

export default function CharactersSection() {
  const { data, loading } = useSectionContent('characters')

  if (loading || !data?.sections?.length) {
    return null
  }

  return (
    <>
      {data.sections.map(section => (
        <CharacterSectionBlock key={section.id} section={section} />
      ))}
    </>
  )
}
```

- [x] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharactersSection.test.jsx`
Expected: 4개 테스트 전부 PASS

- [x] **Step 5: 커밋**

```bash
git add src/components/CharactersSection.jsx src/components/__tests__/CharactersSection.test.jsx
git commit -m "feat: CharactersSection이 섹션 배열을 순회하는 컨테이너로 축소됨"
```

---

### Task 3: `Navbar` — 캐릭터 섹션마다 네비게이션 항목 동적 생성

**Files:**
- Modify: `src/components/Navbar.jsx`
- Create: `src/components/__tests__/Navbar.test.jsx`

**Interfaces:**
- Consumes: `useSectionContent('characters')` — `data.sections` 배열 (Task 2와 동일한 shape)
- Produces: 없음 (leaf 컴포넌트)

- [x] **Step 1: 테스트 파일 작성 (실패 상태)**

`src/components/__tests__/Navbar.test.jsx` 신규 작성:

```jsx
import { render, screen } from '@testing-library/react'
import Navbar from '../Navbar'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

describe('Navbar', () => {
  it('캐릭터 섹션이 여러 개면 섹션 제목마다 네비게이션 항목을 만든다', () => {
    useSectionContent.mockReturnValue({
      data: {
        sections: [
          { id: 'photo', heading: '대표 캐릭터 - 사진', categories: [], items: [] },
          { id: 'video', heading: '대표 캐릭터 - 영상', categories: [], items: [] },
        ],
      },
      loading: false,
      error: null,
    })
    render(<Navbar />)
    expect(screen.getByText('대표 캐릭터 - 사진')).toBeInTheDocument()
    expect(screen.getByText('대표 캐릭터 - 영상')).toBeInTheDocument()
  })

  it('로딩 중이면 캐릭터 섹션 네비게이션 항목을 표시하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.queryByText(/대표 캐릭터/)).not.toBeInTheDocument()
  })

  it('고정 항목(소개/경력/Contact)은 항상 표시된다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.getByText('소개')).toBeInTheDocument()
    expect(screen.getByText('경력')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })
})
```

- [x] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/Navbar.test.jsx`
Expected: FAIL — 처음 두 테스트는 `useSectionContent`를 호출하지 않는 지금 `Navbar.jsx`에서 "대표 캐릭터 - 사진"/"대표 캐릭터 - 영상" 텍스트를 찾지 못해 실패 (세 번째 테스트는 이미 PASS할 수 있음)

- [x] **Step 3: `Navbar.jsx` 수정**

`src/components/Navbar.jsx` 전체를 다음으로 교체:

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-scroll'
import { useSectionContent } from '../hooks/useSectionContent'

const LINKS_BEFORE_CHARACTERS = [
  { label: '소개', to: 'about' },
  { label: '경력', to: 'career' },
]

const LINKS_AFTER_CHARACTERS = [
  { label: 'Contact', to: 'contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { data, loading } = useSectionContent('characters')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const characterLinks = (!loading && data?.sections)
    ? data.sections.map(section => ({ label: section.heading, to: `characters-${section.id}` }))
    : []

  const navLinks = [...LINKS_BEFORE_CHARACTERS, ...characterLinks, ...LINKS_AFTER_CHARACTERS]

  return (
    <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${
      scrolled ? 'bg-black/80 backdrop-blur-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link
          to="hero"
          smooth
          duration={500}
          className="text-white font-bold text-lg cursor-pointer"
        >
          NANARY
        </Link>
        <div className="flex gap-6">
          {navLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              smooth
              duration={500}
              offset={-70}
              className="text-white/80 hover:text-white cursor-pointer text-sm transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
```

- [x] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/Navbar.test.jsx`
Expected: 3개 테스트 전부 PASS

- [x] **Step 5: 커밋**

```bash
git add src/components/Navbar.jsx src/components/__tests__/Navbar.test.jsx
git commit -m "feat: Navbar가 캐릭터 섹션마다 네비게이션 항목을 동적으로 생성"
```

---

### Task 4: `CharactersForm` — 섹션 단위 추가/삭제/순서변경 지원

**Files:**
- Modify: `src/components/admin/sections/CharactersForm.jsx`

**Interfaces:**
- Consumes: 기존 `TextField`/`ImageField`/`ListField` (변경 없음, `ListField`는 이미 중첩 사용 검증됨)
- Produces: `onSave`로 `{ sections: [{id, heading, categories, items}, ...] }` 형태를 전달 — Task 2/3이 소비하는 shape와 정확히 일치해야 함

- [x] **Step 1: `CharactersForm.jsx` 전체 교체**

`src/components/admin/sections/CharactersForm.jsx` 전체를 다음으로 교체:

```jsx
import { useState } from 'react'
import TextField from '../fields/TextField'
import ImageField from '../fields/ImageField'
import ListField from '../fields/ListField'

export default function CharactersForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <ListField
        label="캐릭터 섹션"
        items={form.sections}
        onChange={sections => update('sections', sections)}
        newItem={{ id: Date.now(), heading: '', categories: ['전체'], items: [] }}
        addLabel="섹션 추가"
        reorderable
        renderItem={({ item: section, index, onChange }) => (
          <>
            <TextField
              label="섹션 제목"
              value={section.heading}
              onChange={v => onChange(index, { ...section, heading: v })}
            />
            <ListField
              label="카테고리 (첫 번째는 '전체' 권장)"
              items={section.categories}
              onChange={categories => onChange(index, { ...section, categories })}
              newItem="카테고리"
              addLabel="카테고리 추가"
              renderItem={({ item, index: catIndex, onChange: onCatChange }) => (
                <TextField label={`카테고리 ${catIndex + 1}`} value={item} onChange={v => onCatChange(catIndex, v)} />
              )}
            />
            <ListField
              label="캐릭터"
              items={section.items}
              onChange={items => onChange(index, { ...section, items })}
              newItem={{ id: Date.now(), title: '', category: section.categories[1] ?? '', thumbnail: '', photos: [] }}
              addLabel="캐릭터 추가"
              renderItem={({ item, index: itemIndex, onChange: onItemChange }) => (
                <>
                  <TextField label="캐릭터/작품명" value={item.title} onChange={v => onItemChange(itemIndex, { ...item, title: v })} />
                  <TextField label="카테고리" value={item.category} onChange={v => onItemChange(itemIndex, { ...item, category: v })} />
                  <ImageField
                    label="사진 (카드 대표 사진)"
                    value={item.thumbnail}
                    onChange={v => onItemChange(itemIndex, { ...item, thumbnail: v })}
                    hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
                  />
                  <ListField
                    label="갤러리 사진 (필수, 모달에서 순서대로 넘겨봄 — 영상이 있으면 마지막에 이어서 표시)"
                    items={item.photos ?? []}
                    onChange={photos => onItemChange(itemIndex, { ...item, photos })}
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
                  <TextField label="유튜브 영상 ID 또는 링크 (선택, 갤러리 마지막에 추가됨)" value={item.youtubeId || ''} onChange={v => onItemChange(itemIndex, { ...item, youtubeId: v })} />
                  <TextField
                    label="시작 시간 (초, 선택 — 유튜브 영상 있을 때만)"
                    value={item.youtubeStart ?? ''}
                    onChange={v => onItemChange(itemIndex, { ...item, youtubeStart: v === '' ? undefined : Number(v) })}
                  />
                  <TextField label="로컬 영상 파일 URL (선택, 유튜브 없을 때만)" value={item.localVideoSrc || ''} onChange={v => onItemChange(itemIndex, { ...item, localVideoSrc: v })} />
                </>
              )}
            />
          </>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
```

- [x] **Step 2: 전체 테스트 스위트 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 PASS (`CharactersForm.jsx`는 이 코드베이스에 전용 테스트 파일이 없음 — 검증은 전체 스위트 + 빌드로 대체, 기존 관례와 동일)

- [x] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [x] **Step 4: 커밋**

```bash
git add src/components/admin/sections/CharactersForm.jsx
git commit -m "feat: 관리자 캐릭터 폼에서 섹션 단위 추가/삭제/순서변경 지원"
```

---

### Task 5: 마이그레이션 SQL 작성

**Files:**
- Create: `supabase/update-characters-sections.sql`

**Interfaces:**
- Consumes: 없음 (독립 SQL 파일)
- Produces: `site_content` 테이블의 `section='characters'` 행 — Task 1~4가 소비하는 `{ sections: [...] }` shape로 변환. Task 6에서 실행 여부를 확인함

이 프로젝트의 기존 관례(`supabase/update-*.sql`)는 현재 데이터를 알고 있다는 전제로 리터럴 JSON을 통째로 넣는 방식이지만, 이번 마이그레이션은 운영 DB에 실제로 어떤 캐릭터가 등록되어 있는지 이 세션에서 알 수 없으므로, 현재 값을 읽어서 변환하는 동적 SQL로 작성한다.

- [x] **Step 1: `supabase/update-characters-sections.sql` 작성**

```sql
-- '대표 캐릭터' 섹션을 사진/영상 두 섹션으로 분리하는 마이그레이션.
-- 기존 site_content.section='characters' 행의 { heading, categories, items } 구조를
-- { sections: [ {id, heading, categories, items}, ... ] } 구조로 변환한다.
-- 영상 필드(youtubeId/localVideoSrc/레거시 type=local+src)가 있는 캐릭터는 '영상' 섹션으로,
-- 없는 캐릭터는 '사진' 섹션으로 자동 분류한다.
-- 실행 전 아래 select로 현재 값을 확인/백업해두는 것을 권장.

-- 실행 전 확인용:
-- select data from site_content where section = 'characters';

update site_content
set data = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'id', 'photo',
      'heading', '대표 캐릭터 - 사진',
      'categories', coalesce(data->'categories', '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) item
        where not (
          coalesce(item->>'youtubeId', '') <> ''
          or coalesce(item->>'localVideoSrc', '') <> ''
          or (item->>'type' = 'local' and coalesce(item->>'src', '') <> '')
        )
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'id', 'video',
      'heading', '대표 캐릭터 - 영상',
      'categories', coalesce(data->'categories', '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) item
        where (
          coalesce(item->>'youtubeId', '') <> ''
          or coalesce(item->>'localVideoSrc', '') <> ''
          or (item->>'type' = 'local' and coalesce(item->>'src', '') <> '')
        )
      ), '[]'::jsonb)
    )
  ),
  updated_at = now()
where section = 'characters';

-- 실행 후 확인용:
-- select data from site_content where section = 'characters';
```

- [x] **Step 2: 커밋 (SQL 파일만 — 아직 운영 DB에는 실행하지 않음)**

```bash
git add supabase/update-characters-sections.sql
git commit -m "feat: 대표 캐릭터 사진/영상 섹션 분리 마이그레이션 SQL 추가"
```

---

### Task 6: 통합 검증 및 마이그레이션 실행 확인

**Files:** 없음 (코드 변경 없음, 검증 및 배포 조율만)

- [x] **Step 1: 전체 테스트 스위트 최종 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS, 실패 0건

- [x] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [x] **Step 3: 로컬 프리뷰로 관리자 폼 수동 확인**

`npm run preview`로 로컬 서버를 띄우고 실제 로그인 세션으로 관리자 페이지의 "대표 캐릭터" 폼에서:
1. (마이그레이션 실행 전이라 실제 DB 데이터는 아직 옛 구조 — 이 스텝은 로컬에서 `form.sections`가 최소 1개 있는 임시 데이터로 진행하거나, Task 6 Step 4 이후 실제 데이터로 재확인)
2. "섹션 추가" 버튼으로 새 섹션이 추가되는지, 드래그로 섹션 순서를 바꿀 수 있는지 확인
3. 섹션 안에서 카테고리/캐릭터를 추가하고 저장 후 새로고침해도 유지되는지 확인
4. 섹션 삭제 버튼으로 섹션 전체가 삭제되는지 확인

- [x] **Step 4: 마이그레이션 실행 여부 확인 (사용자 승인 필요)**

에릭에게 다음을 확인받는다:
- 지금 실제 운영 Supabase `site_content.section='characters'` 행에 `supabase/update-characters-sections.sql`을 실행해도 되는지
- 실행 시점은 Task 1~4의 새 프론트엔드 코드가 배포된 직후여야 함 (구코드가 떠 있는 상태에서 먼저 실행하면 그동안 캐릭터 섹션이 비어 보일 수 있음 — 스펙 "마이그레이션" 섹션 참고)

승인 후 에릭이 Supabase 대시보드 SQL Editor에서 직접 실행 (또는 요청 시 함께 진행). 이 스텝은 코드 변경이 아니므로 git 커밋 없음.

- [x] **Step 5: 마이그레이션 후 공개 페이지 확인**

마이그레이션 실행 후, 배포된 실제 사이트(또는 `.env.local`을 운영 Supabase로 맞춘 로컬 프리뷰)에서:
1. "대표 캐릭터 - 사진"과 "대표 캐릭터 - 영상" 두 섹션이 순서대로 보이는지 확인
2. 상단 네비게이션에 두 섹션 제목이 각각 링크로 나타나고, 클릭 시 해당 섹션으로 스크롤되는지 확인
3. 기존에 영상이 있던 캐릭터는 "영상" 섹션에, 없던 캐릭터는 "사진" 섹션에 정확히 분류되어 있는지 확인

이 스텝도 코드 변경이 없으므로 git 커밋 없음.
