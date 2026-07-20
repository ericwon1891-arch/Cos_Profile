# 캐릭터 사진+영상 혼합 갤러리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캐릭터 하나에 갤러리 사진과 유튜브(또는 로컬) 영상을 함께 올려서, 모달에서 사진들 → 영상 순서로 넘겨볼 수 있게 한다.

**Architecture:** `PhotoModal`을 "사진 슬라이드 + (있다면) 영상 슬라이드 1개"를 순회하는 범용 모달로 확장하고, 기존 `VideoModal`을 삭제해 그 렌더링 로직을 흡수한다. 관리자 폼에서는 "타입 선택" 개념을 없애고, 채워진 필드(갤러리 사진/유튜브 ID/로컬 영상)만큼 자동으로 조합한다.

**Tech Stack:** React 18, Vite, Tailwind CSS, Vitest + @testing-library/react (기존 스택 그대로, 신규 의존성 없음)

## Global Constraints

- 신규 의존성 추가 없음
- 기존 캐릭터 데이터(사진 전용, 영상 전용)는 마이그레이션 없이 그대로 동작해야 한다 — `type`/`src` 필드는 관리자 폼에서 더는 편집하지 않지만, 레거시 데이터 폴백에는 계속 쓰인다 (스펙 "슬라이드 구성 규칙" 섹션)
- 로컬 영상에는 시작 시간을 지원하지 않는다 (유튜브만) — 스펙 "범위 밖"
- 유튜브 링크 URL 붙여넣기로 ID/시작시간을 자동 파싱하지 않는다 — 관리자가 영상 ID와 시작 시간(초)을 각각 입력 (스펙 "범위 밖")

참고 스펙: `docs/superpowers/specs/2026-07-21-character-mixed-media-gallery-design.md`

---

### Task 1: PhotoModal — 사진+영상 슬라이드 통합

**Files:**
- Modify: `src/components/PhotoModal.jsx`
- Modify: `src/components/__tests__/PhotoModal.test.jsx` (전체 교체)

**Interfaces:**
- Consumes: `work` prop — `{ id, title, photos?, src?, type?, youtubeId?, youtubeStart?, localVideoSrc? }`
- Produces: 없음 (leaf 컴포넌트). Task 2의 `CharactersSection.jsx`가 `VideoModal` 대신 이 컴포넌트 하나만 사용하게 됨.

- [ ] **Step 1: 테스트 파일을 다음 내용으로 전체 교체 (실패 상태로 만듦)**

`src/components/__tests__/PhotoModal.test.jsx` 전체를 다음으로 교체:

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

const legacyYoutubeWork = {
  id: 3,
  title: '레거시 유튜브',
  type: 'youtube',
  youtubeId: 'abc123',
}

const legacyLocalVideoWork = {
  id: 4,
  title: '레거시 로컬 영상',
  type: 'local',
  src: '/videos/test.mp4',
}

const mixedYoutubeWork = {
  id: 5,
  title: '혼합 캐릭터',
  photos: ['/photos/a.jpg', '/photos/b.jpg'],
  youtubeId: 'xyz789',
  youtubeStart: 93,
}

const mixedLocalVideoWork = {
  id: 6,
  title: '혼합 로컬 영상',
  photos: ['/photos/a.jpg'],
  localVideoSrc: '/videos/mixed.mp4',
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

  it('슬라이드가 1개면 화살표/카운터를 표시하지 않는다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이전')).not.toBeInTheDocument()
  })

  it('사진이 여러 장이면 첫 사진과 카운터를 표시한다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/a.jpg')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('다음 버튼 클릭 시 다음 슬라이드로 넘어간다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/b.jpg')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('첫 슬라이드에서 이전 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByLabelText('이전')).toBeDisabled()
  })

  it('마지막 슬라이드에서 다음 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByLabelText('다음')).toBeDisabled()
  })

  it('photos가 빈 문자열 슬롯만 있으면 대표 사진으로 대체된다', () => {
    const work = { ...photoWork, photos: [''] }
    render(<PhotoModal work={work} onClose={() => {}} />)
    expect(screen.getByAltText('테스트 사진')).toHaveAttribute('src', '/photos/test.jpg')
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
  })

  it('photos에 빈 문자열 슬롯이 섞여 있으면 걸러내고 유효한 사진만 표시한다', () => {
    const work = { ...galleryWork, photos: ['/photos/a.jpg', '', '/photos/b.jpg'] }
    render(<PhotoModal work={work} onClose={() => {}} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('레거시 유튜브 전용 캐릭터는 영상 슬라이드 하나만 표시한다', () => {
    render(<PhotoModal work={legacyYoutubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
  })

  it('레거시 로컬 영상 전용 캐릭터는 video 엘리먼트를 표시한다', () => {
    render(<PhotoModal work={legacyLocalVideoWork} onClose={() => {}} />)
    const video = screen.getByTestId('local-video')
    expect(video).toHaveAttribute('src', '/videos/test.mp4')
  })

  it('사진+유튜브 혼합이면 사진들 다음 마지막에 영상 슬라이드가 온다', () => {
    render(<PhotoModal work={mixedYoutubeWork} onClose={() => {}} />)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/xyz789'))
    expect(screen.getByLabelText('다음')).toBeDisabled()
  })

  it('youtubeStart가 있으면 embed URL에 start 파라미터를 붙인다', () => {
    render(<PhotoModal work={mixedYoutubeWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('start=93'))
  })

  it('youtubeStart가 없으면 embed URL에 start 파라미터가 없다', () => {
    render(<PhotoModal work={legacyYoutubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe.getAttribute('src')).not.toContain('start=')
  })

  it('사진+로컬 영상 혼합이면 마지막 슬라이드에 video 엘리먼트를 표시한다', () => {
    render(<PhotoModal work={mixedLocalVideoWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    const video = screen.getByTestId('local-video')
    expect(video).toHaveAttribute('src', '/videos/mixed.mp4')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/PhotoModal.test.jsx`
Expected: 기존 사진 관련 테스트 일부는 아직 통과할 수 있지만(로직이 이전과 유사), 아리아 라벨이 `다음 사진`→`다음`, `이전 사진`→`이전`으로 바뀐 테스트들과 영상 슬라이드 관련 신규 테스트(레거시 유튜브/로컬, 혼합, start 파라미터)는 FAIL — `getByLabelText('다음')` 등을 찾지 못하거나 `getByTitle('video-player')`/`getByTestId('local-video')`를 찾지 못해서 에러

- [ ] **Step 3: PhotoModal.jsx를 슬라이드(사진+영상) 통합 버전으로 교체**

`src/components/PhotoModal.jsx` 전체를 다음 내용으로 교체:

```jsx
import { useState } from 'react'

function buildSlides(work) {
  const galleryPhotos = work.photos?.filter(Boolean) ?? []
  const photos = galleryPhotos.length
    ? galleryPhotos
    : (work.type === 'photo' ? [work.src].filter(Boolean) : [])
  const photoSlides = photos.map(url => ({ kind: 'image', url }))

  const videoSlide = work.youtubeId
    ? { kind: 'youtube', id: work.youtubeId, start: work.youtubeStart }
    : work.localVideoSrc
      ? { kind: 'local', src: work.localVideoSrc }
      : (work.type === 'local' && work.src)
        ? { kind: 'local', src: work.src }
        : null

  return videoSlide ? [...photoSlides, videoSlide] : photoSlides
}

export default function PhotoModal({ work, onClose }) {
  const slides = buildSlides(work)
  const [index, setIndex] = useState(0)
  const hasMultiple = slides.length > 1
  const current = slides[index]

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
        {current?.kind === 'image' && (
          <img
            src={current.url}
            alt={work.title}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}
        {current?.kind === 'youtube' && (
          <div className="aspect-video">
            <iframe
              title="video-player"
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${current.id}?autoplay=1${current.start ? `&start=${current.start}` : ''}`}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        )}
        {current?.kind === 'local' && (
          <div className="aspect-video">
            <video
              data-testid="local-video"
              className="w-full h-full"
              src={current.src}
              controls
              autoPlay
            />
          </div>
        )}
        {hasMultiple && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="이전"
            >
              ‹
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i + 1)}
              disabled={index === slides.length - 1}
              aria-label="다음"
            >
              ›
            </button>
            <p className="text-center text-white text-sm mt-2">{index + 1} / {slides.length}</p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/PhotoModal.test.jsx`
Expected: 17개 테스트 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/PhotoModal.jsx src/components/__tests__/PhotoModal.test.jsx
git commit -m "feat: PhotoModal이 사진+영상 슬라이드를 함께 순회하도록 확장"
```

---

### Task 2: VideoModal 제거, CharactersSection 모달 통합

**Files:**
- Delete: `src/components/VideoModal.jsx`
- Delete: `src/components/__tests__/VideoModal.test.jsx`
- Modify: `src/components/CharactersSection.jsx`
- Modify: `src/components/__tests__/CharactersSection.test.jsx`

**Interfaces:**
- Consumes: Task 1의 `PhotoModal` (props 변경 없음 — `work`/`onClose`/`key`)
- Produces: 없음

- [ ] **Step 1: VideoModal과 그 테스트 파일 삭제**

```bash
git rm src/components/VideoModal.jsx src/components/__tests__/VideoModal.test.jsx
```

- [ ] **Step 2: CharactersSection.jsx에서 type 기반 분기를 제거하고 PhotoModal 하나만 렌더링**

`src/components/CharactersSection.jsx`에서 아래 부분을 찾는다:

```jsx
import { useState } from 'react'
import { useSectionContent } from '../hooks/useSectionContent'
import WorkCard from './WorkCard'
import VideoModal from './VideoModal'
import PhotoModal from './PhotoModal'
```

다음으로 교체:

```jsx
import { useState } from 'react'
import { useSectionContent } from '../hooks/useSectionContent'
import WorkCard from './WorkCard'
import PhotoModal from './PhotoModal'
```

그리고 파일 맨 아래쪽의 아래 부분을 찾는다:

```jsx
      {selectedWork && selectedWork.type === 'photo' && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
      {selectedWork && selectedWork.type !== 'photo' && (
        <VideoModal work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
```

다음으로 교체:

```jsx
      {selectedWork && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
```

- [ ] **Step 3: CharactersSection.test.jsx의 VideoModal 관련 테스트 설명을 갱신**

`src/components/__tests__/CharactersSection.test.jsx`에서 아래 테스트를 찾는다:

```jsx
  it('youtube 타입 카드 클릭 시 VideoModal이 열린다', () => {
    render(<CharactersSection />)
    fireEvent.click(screen.getAllByTestId('work-card')[2])
    expect(screen.getByTitle('video-player')).toBeInTheDocument()
  })
```

다음으로 교체 (동작은 동일 — 이제 VideoModal이 아니라 PhotoModal의 영상 슬라이드 분기가 같은 `video-player` iframe을 렌더링한다):

```jsx
  it('youtube 타입 카드 클릭 시 모달에 영상 슬라이드가 열린다', () => {
    render(<CharactersSection />)
    fireEvent.click(screen.getAllByTestId('work-card')[2])
    expect(screen.getByTitle('video-player')).toBeInTheDocument()
  })
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/CharactersSection.test.jsx`
Expected: 6개 테스트 전부 PASS

- [ ] **Step 5: 전체 테스트 스위트 실행 (VideoModal 삭제로 다른 곳이 깨지지 않았는지 확인)**

Run: `npm test -- --run`
Expected: 모든 테스트 파일 PASS, VideoModal 관련 파일이 더 이상 목록에 없음

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: VideoModal 제거, CharactersSection이 PhotoModal 하나로 통합"
```

---

### Task 3: WorkCard 재생 아이콘 조건을 영상 유무 기준으로 변경

**Files:**
- Modify: `src/components/WorkCard.jsx`
- Modify: `src/components/__tests__/WorkCard.test.jsx`

**Interfaces:**
- Consumes: 없음 (leaf 컴포넌트, `work` prop 형태는 이미 다른 곳에서 정의됨)
- Produces: 없음

- [ ] **Step 1: 신규 테스트를 추가해 실패 상태로 만든다**

`src/components/__tests__/WorkCard.test.jsx`에서 마지막 `it` 블록 다음, `})`(describe 닫는 괄호) 앞에 아래 두 테스트를 추가:

```jsx
  it('사진+영상 혼합일 때도 재생 아이콘을 표시한다', () => {
    const mixedWork = {
      id: 3,
      title: '혼합',
      category: '카테고리 1',
      photos: ['/photos/a.jpg'],
      youtubeId: 'xyz',
      thumbnail: '/thumbnails/mixed.jpg',
    }
    render(<WorkCard work={mixedWork} onClick={() => {}} />)
    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
  })

  it('레거시 로컬 영상 타입일 때도 재생 아이콘을 표시한다', () => {
    const legacyLocalWork = {
      id: 4,
      title: '로컬 영상',
      category: '카테고리 1',
      type: 'local',
      src: '/videos/test.mp4',
      thumbnail: '/thumbnails/local.jpg',
    }
    render(<WorkCard work={legacyLocalWork} onClick={() => {}} />)
    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해서 신규 테스트가 실패하는지 확인**

Run: `npm test -- --run src/components/__tests__/WorkCard.test.jsx`
Expected: 기존 5개는 PASS, 신규 2개 중 "사진+영상 혼합" 케이스는 FAIL(`type`이 없어서 현재 로직상 `isPhoto`가 `false`가 아니라 `true`가 되어 `photo-icon`이 뜸 → `play-icon`을 찾지 못해 실패)

- [ ] **Step 3: WorkCard.jsx의 아이콘 조건을 영상 유무 기준으로 변경**

`src/components/WorkCard.jsx`에서 아래 줄을 찾는다:

```jsx
  const isPhoto = work.type === 'photo'
```

다음으로 교체:

```jsx
  const hasVideo = Boolean(work.youtubeId || work.localVideoSrc || (work.type === 'local' && work.src))
  const isPhoto = !hasVideo
```

- [ ] **Step 4: 테스트 실행해서 전부 통과하는지 확인**

Run: `npm test -- --run src/components/__tests__/WorkCard.test.jsx`
Expected: 7개 테스트 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/WorkCard.jsx src/components/__tests__/WorkCard.test.jsx
git commit -m "feat: WorkCard 재생 아이콘을 type 대신 영상 유무 기준으로 표시"
```

---

### Task 4: CharactersForm — 타입 선택 제거, 유튜브 시작시간/로컬 영상 필드 추가

**Files:**
- Modify: `src/components/admin/sections/CharactersForm.jsx`

**Interfaces:**
- Consumes: 기존 `TextField`/`ImageField`/`ListField` (변경 없음)
- Produces: 캐릭터 데이터에 `photos`(기존), `youtubeId`(기존), `youtubeStart`(신규, number|undefined), `localVideoSrc`(신규, string) 필드를 채워서 `onSave`로 전달 — Task 1의 `PhotoModal`이 소비하는 필드명과 정확히 일치해야 함. `type`/`src`는 더 이상 이 폼에서 쓰지 않음(신규 항목의 `newItem`에서 제거).

- [ ] **Step 1: CharactersForm.jsx 수정**

`src/components/admin/sections/CharactersForm.jsx`에서 아래 블록을 찾는다:

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

다음으로 교체:

```jsx
        newItem={{ id: Date.now(), title: '', category: form.categories[1] ?? '', thumbnail: '', photos: [] }}
        addLabel="캐릭터 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="캐릭터/작품명" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextField label="카테고리" value={item.category} onChange={v => onChange(index, { ...item, category: v })} />
            <ImageField
              label="사진 (카드 대표 사진)"
              value={item.thumbnail}
              onChange={v => onChange(index, { ...item, thumbnail: v })}
              hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
            />
            <ListField
              label="갤러리 사진 (필수, 모달에서 순서대로 넘겨봄 — 영상이 있으면 마지막에 이어서 표시)"
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
            <TextField label="유튜브 영상 ID (선택, 갤러리 마지막에 추가됨)" value={item.youtubeId || ''} onChange={v => onChange(index, { ...item, youtubeId: v })} />
            <TextField
              label="시작 시간 (초, 선택 — 유튜브 영상 있을 때만)"
              value={item.youtubeStart ?? ''}
              onChange={v => onChange(index, { ...item, youtubeStart: v === '' ? undefined : Number(v) })}
            />
            <TextField label="로컬 영상 파일 URL (선택, 유튜브 없을 때만)" value={item.localVideoSrc || ''} onChange={v => onChange(index, { ...item, localVideoSrc: v })} />
          </>
        )}
```

- [ ] **Step 2: 전체 테스트 스위트 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 PASS (`CharactersForm.jsx`는 이 코드베이스에 전용 테스트 파일이 없음 — 검증은 전체 스위트 + 빌드로 대체)

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/components/admin/sections/CharactersForm.jsx
git commit -m "feat: 캐릭터 관리자 폼에서 타입 선택 제거, 유튜브 시작시간/로컬 영상 필드 추가"
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

- [ ] **Step 3: 수동 브라우저 검증**

`npm run preview`로 로컬 서버를 띄우고 실제 로그인 세션으로 관리자 페이지의 캐릭터 편집 폼에서:
1. 기존 캐릭터 하나(사진만 있던 것)를 열어 필드가 그대로 남아있는지 확인 (타입 필드는 이제 안 보임)
2. 새 캐릭터에 갤러리 사진 2장 + 유튜브 영상 ID + 시작 시간(예: 30)을 채워 저장
3. 공개 홈페이지에서 그 캐릭터 카드에 재생 아이콘이 뜨는지, 클릭 시 사진 2장 → 마지막에 유튜브 영상이 30초부터 재생되는지 확인
4. 기존 유튜브 전용 캐릭터를 클릭해서 여전히 영상만 바로 재생되는지 확인 (하위 호환)

이 Step은 커밋 대상 코드 변경이 없으므로 git 커밋 없음.
