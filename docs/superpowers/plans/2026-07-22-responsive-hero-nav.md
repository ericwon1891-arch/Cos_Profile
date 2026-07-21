# Hero 레터박스 + 모바일 햄버거 네비게이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hero 배경 사진이 초광폭 데스크톱/세로로 긴 모바일에서 과도하게 잘리는 문제를 비율 기반 레터박스로 해결하고, 모바일 세로모드에서 네비게이션 항목이 넘쳐 정렬이 깨지는 문제를 햄버거 메뉴로 해결한다.

**Architecture:** `HeroSection.jsx`의 `<img>`에 Tailwind 임의 값 미디어쿼리(`[@media(min-aspect-ratio:3/2)]:object-contain`, `[@media(max-aspect-ratio:3/4)]:object-contain`)를 추가해 극단적 비율에서만 `object-fit`이 `cover`→`contain`으로 전환되게 한다. `Navbar.jsx`는 데스크톱 가로 메뉴(`hidden md:flex`)와 모바일 햄버거+드롭다운 패널(`md:hidden`)로 나눈다.

**Tech Stack:** React 18, Vite, Tailwind CSS, Vitest + @testing-library/react — 신규 의존성 없음

작업 브랜치: `반응형` (main에서 분기, 완료 후 병합 여부 별도 결정)

참고 스펙: `docs/superpowers/specs/2026-07-22-responsive-hero-nav-design.md`

## Global Constraints

- 신규 의존성 추가 없음
- Hero 사진을 여러 장으로 관리하는 art-direction 방식 하지 않는다 — 관리자는 지금처럼 사진 한 장만 올린다 (스펙 "Non-goals")
- 모바일 메뉴 열림 중 배경 스크롤 잠금 하지 않는다 (스펙 "Non-goals")
- `md`(768px) 이상에서 Navbar의 기존 가로 메뉴 동작/스타일은 전혀 변경되지 않는다
- 일반적인 뷰포트 비율(0.75~1.5)에서 Hero 이미지의 기존 `object-cover` 동작은 전혀 변경되지 않는다

---

### Task 1: Hero 이미지 비율 기반 레터박스

**Files:**
- Modify: `src/components/HeroSection.jsx`
- Create: `src/components/__tests__/HeroSection.test.jsx`

**Interfaces:**
- Consumes: 기존과 동일한 `useSectionContent('hero')` 반환값 (`{ photo, label, name, subtitle, quote, facts }`) — 형태 변경 없음
- Produces: 없음 (leaf 컴포넌트)

- [ ] **Step 1: 테스트 파일 작성 (실패 상태)**

`src/components/__tests__/HeroSection.test.jsx` 신규 작성:

```jsx
import { render } from '@testing-library/react'
import HeroSection from '../HeroSection'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

describe('HeroSection', () => {
  it('일반 비율에서는 object-cover를 유지하고, 극단적 비율(초광폭/세로로 긴 화면)에서 object-contain으로 전환되는 미디어쿼리 클래스를 포함한다', () => {
    useSectionContent.mockReturnValue({
      data: {
        photo: '/hero.jpg',
        label: '라벨',
        name: '이름',
        subtitle: '부제목',
        quote: '인용구',
        facts: [],
      },
      loading: false,
      error: null,
    })
    const { container } = render(<HeroSection />)
    const img = container.querySelector('img')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('[@media(min-aspect-ratio:3/2)]:object-contain')
    expect(img.className).toContain('[@media(max-aspect-ratio:3/4)]:object-contain')
  })

  it('로딩 중이면 이미지를 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    const { container } = render(<HeroSection />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/HeroSection.test.jsx`
Expected: 첫 번째 테스트는 FAIL — 지금 `img`의 className에 `[@media(min-aspect-ratio:3/2)]:object-contain`/`[@media(max-aspect-ratio:3/4)]:object-contain`이 없어서 `toContain` 실패. 두 번째 테스트(로딩 중)는 이미 PASS할 수 있음

- [ ] **Step 3: `HeroSection.jsx`의 이미지 className 수정**

`src/components/HeroSection.jsx`에서 아래 줄을 찾는다:

```jsx
      <img
        src={photo}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover object-top md:object-center opacity-40"
        onError={e => { e.target.style.display = 'none' }}
      />
```

다음으로 교체:

```jsx
      <img
        src={photo}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover object-top md:object-center opacity-40 [@media(min-aspect-ratio:3/2)]:object-contain [@media(max-aspect-ratio:3/4)]:object-contain"
        onError={e => { e.target.style.display = 'none' }}
      />
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/HeroSection.test.jsx`
Expected: 2개 테스트 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/HeroSection.jsx src/components/__tests__/HeroSection.test.jsx
git commit -m "feat: Hero 이미지가 극단적 화면비율에서 레터박스로 전환되도록 수정"
```

---

### Task 2: Navbar 모바일 햄버거 메뉴

**Files:**
- Modify: `src/components/Navbar.jsx`
- Modify: `src/components/__tests__/Navbar.test.jsx`

**Interfaces:**
- Consumes: 기존과 동일한 `useSectionContent('characters')` 반환값 — 형태 변경 없음
- Produces: 없음 (leaf 컴포넌트). 데스크톱 메뉴는 `data-testid="desktop-nav"`, 모바일 드롭다운 패널은 `data-testid="mobile-nav-panel"`을 갖는다 (테스트에서 두 메뉴를 구분하기 위함)

- [ ] **Step 1: 테스트 파일에 햄버거 메뉴 관련 케이스 추가 (실패 상태로 만듦)**

`src/components/__tests__/Navbar.test.jsx` 최상단 import를 다음으로 교체:

```jsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import Navbar from '../Navbar'
import { useSectionContent } from '../../hooks/useSectionContent'
```

그리고 `describe` 블록의 마지막 `it` 다음, 닫는 `})` 앞에 아래 3개 테스트를 추가:

```jsx
  it('햄버거 버튼이 렌더링된다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument()
  })

  it('햄버거 버튼 클릭 시 모바일 메뉴 패널이 열리고 네비 항목들이 보인다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.queryByTestId('mobile-nav-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
    const panel = screen.getByTestId('mobile-nav-panel')
    expect(within(panel).getByText('소개')).toBeInTheDocument()
    expect(within(panel).getByText('Contact')).toBeInTheDocument()
  })

  it('메뉴가 열린 상태에서 네비 항목을 클릭하면 메뉴가 닫힌다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
    const panel = screen.getByTestId('mobile-nav-panel')
    fireEvent.click(within(panel).getByText('소개'))
    expect(screen.queryByTestId('mobile-nav-panel')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/Navbar.test.jsx`
Expected: 기존 3개는 PASS, 신규 3개는 FAIL — `getByRole('button', { name: '메뉴 열기' })`를 찾지 못하거나 `getByTestId('mobile-nav-panel')`이 존재하지 않아서 실패

- [ ] **Step 3: `Navbar.jsx`에 햄버거 메뉴 구현**

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
  const [menuOpen, setMenuOpen] = useState(false)
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

  function closeMenu() {
    setMenuOpen(false)
  }

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
        <div data-testid="desktop-nav" className="hidden md:flex gap-6">
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
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className="md:hidden text-white w-8 h-8 flex flex-col items-center justify-center gap-1.5"
          aria-label="메뉴 열기"
        >
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
        </button>
      </div>
      {menuOpen && (
        <div
          data-testid="mobile-nav-panel"
          className="md:hidden bg-black/90 backdrop-blur-sm flex flex-col items-center gap-4 py-6"
        >
          {navLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              smooth
              duration={500}
              offset={-70}
              onClick={closeMenu}
              className="text-white/80 hover:text-white cursor-pointer text-sm transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/Navbar.test.jsx`
Expected: 6개 테스트 전부 PASS

- [ ] **Step 5: 전체 테스트 스위트 실행 (다른 곳에 영향 없는지 확인)**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/Navbar.jsx src/components/__tests__/Navbar.test.jsx
git commit -m "feat: 모바일 세로모드에서 Navbar가 햄버거 메뉴로 전환되도록 추가"
```

---

### Task 3: 통합 검증

**Files:** 없음 (코드 변경 없음, 검증만)

- [ ] **Step 1: 전체 테스트 스위트 최종 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS, 실패 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 3: 수동 브라우저 검증 (여러 화면 크기)**

`npm run dev`로 로컬 서버를 띄우고 브라우저 개발자 도구의 반응형 모드(디바이스 툴바)로 다음을 확인:
1. 매우 넓은 창(예: 2560×1440 비율 흉내, 개발자 도구에서 커스텀 크기 입력)에서 Hero 이미지가 인물이 잘리지 않고 위/아래에 배경색 여백이 자연스럽게 보이는지 확인
2. 일반적인 노트북 화면비(예: 1920×1080, 1366×768)에서는 지금까지와 동일하게 이미지가 화면을 꽉 채우는지 확인 (레터박스가 불필요하게 나타나지 않는지)
3. 모바일 세로모드(예: iPhone 12/13 시뮬레이션, 390×844)에서 Hero 이미지가 좌우로 과도하게 잘리지 않는지 확인
4. 모바일 세로모드에서 상단에 햄버거 아이콘만 보이는지, 탭하면 메뉴가 펼쳐지고 항목(캐릭터 섹션 포함)이 세로로 잘 나열되는지, 항목 클릭 시 해당 섹션으로 스크롤되면서 메뉴가 닫히는지 확인
5. 태블릿/데스크톱 폭(768px 이상)에서는 지금까지와 동일하게 가로 메뉴가 보이고 햄버거 아이콘은 안 보이는지 확인

이 스텝은 커밋 대상 코드 변경이 없으므로 git 커밋 없음.
