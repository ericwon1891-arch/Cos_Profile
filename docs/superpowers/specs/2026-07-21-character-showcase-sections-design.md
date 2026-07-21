# 대표 캐릭터 — 사진/영상 섹션 분리 및 다중 섹션화 Design

**Goal:** 지금 하나로 합쳐진 "대표 캐릭터" 섹션(카테고리 필터 + 카드 그리드 + 사진·영상 통합 모달)을, 독립된 여러 개의 "캐릭터 쇼케이스 섹션"으로 바꾼다. 관리자는 이런 섹션을 자유롭게 추가/삭제/순서변경할 수 있고, 각 섹션 제목도 직접 수정할 수 있다. 기존 데이터는 영상 유무를 기준으로 "사진" 섹션과 "영상" 섹션 두 개로 자동 마이그레이션한다.

**Non-goals:** PhotoModal 내부의 사진+영상 슬라이드 통합 로직(어제 구현분)은 변경하지 않는다 — 한 캐릭터 안에서 사진들 다음에 영상이 이어지는 동작은 그대로 유지. 이번 변경은 "여러 캐릭터를 묶는 섹션" 레벨의 구조 변경이다.

참고: 어제 완료된 `docs/superpowers/specs/2026-07-21-character-mixed-media-gallery-design.md` 위에 쌓이는 변경.

---

## 1. 데이터 구조 & 마이그레이션

### Before
`site_content` 테이블, `section = 'characters'` 행의 `data`:
```js
{ heading: string, categories: string[], items: CharacterItem[] }
```

### After
```js
{
  sections: [
    {
      id: string | number,   // React key + 앵커 id로 사용, 안정적이면 됨
      heading: string,
      categories: string[],
      items: CharacterItem[], // 기존 CharacterItem 형태 변경 없음
    },
    // ...관리자가 추가한 만큼 더 있을 수 있음
  ]
}
```

`CharacterItem` 자체 필드(`title`, `category`, `thumbnail`, `photos`, `youtubeId`, `youtubeStart`, `localVideoSrc` 등)는 전혀 바뀌지 않는다.

### 마이그레이션
`supabase/` 아래에 새 SQL 파일 추가 (기존 `schema.sql`/`seed.sql`처럼 Supabase SQL Editor에서 수동 실행하는 방식, 파일명 예: `supabase/migrations/2026-07-21-characters-sections.sql`).

기존 `items`를 다음 조건으로 분류:
- **영상 있음** (`youtubeId`가 non-empty, 또는 `localVideoSrc`가 non-empty, 또는 레거시 `type === 'local'`이고 `src`가 non-empty) → `대표 캐릭터 - 영상` 섹션 (`id: 'video'`)
- 그 외 전부 → `대표 캐릭터 - 사진` 섹션 (`id: 'photo'`)

두 섹션 모두 기존 `categories` 배열을 그대로 복사해서 시작한다 (분리 후 관리자가 섹션별로 자유롭게 편집).

**실행 시점 주의:** 이 SQL은 실제 운영 Supabase DB에 적용되는 변경이므로, 담당자(에릭)의 명시적 확인 없이 자동 실행하지 않는다. 새로운 프론트엔드 코드가 배포된 시점과 맞춰서 실행해야 한다 — 구코드는 `{heading, categories, items}`를, 신코드는 `{sections: [...]}`를 기대하므로 배포/마이그레이션 순서가 어긋나면 그 사이 캐릭터 섹션이 잠깐 비어 보일 수 있다 (개인 포트폴리오 사이트 규모라 짧은 공백은 허용 가능하다고 판단).

---

## 2. 공개 페이지 컴포넌트

### `CharactersSection.jsx` — 컨테이너로 축소
```jsx
export default function CharactersSection() {
  const { data, loading } = useSectionContent('characters')
  if (loading || !data) return null
  return (
    <>
      {data.sections.map(section => (
        <CharacterSectionBlock key={section.id} section={section} />
      ))}
    </>
  )
}
```

### `CharacterSectionBlock.jsx` (신규)
지금 `CharactersSection.jsx`가 담당하던 렌더링(카테고리 필터 state, 카드 그리드, `PhotoModal` 열림/닫힘 state)을 그대로 옮겨온다. `section` prop 하나만 받는다.

- `<section id={`characters-${section.id}`} className="py-20 ...">` — 섹션마다 고유 앵커
- `activeFilter`, `selectedWork` state는 이 블록 내부에 로컬로 유지 (섹션끼리 서로 영향 주지 않음)
- 나머지(필터 버튼, 그리드, `WorkCard`/`PhotoModal` 사용법)는 지금 로직 그대로 이식

---

## 3. 네비게이션

`Navbar.jsx`:
- 정적 `NAV_LINKS`에서 `{ label: '대표 캐릭터', to: 'characters' }` 항목 제거
- `useSectionContent('characters')`를 호출해서 `data?.sections ?? []`를 `{ label: section.heading, to: `characters-${section.id}` }`로 매핑
- 렌더링 시 원래 위치(경력 ↔ Contact 사이)에 이 동적 목록을 끼워 넣음
- 로딩 중이거나 데이터 없으면 그 구간은 비움 (다른 곳도 별도 에러 UI 없이 이렇게 처리하는 기존 패턴과 통일)

---

## 4. 관리자 폼

`CharactersForm.jsx`:
- 지금 폼 전체(제목 `TextField` + 카테고리 `ListField` + 캐릭터 `ListField`)를 새로운 바깥쪽 `ListField`의 `renderItem`으로 감싼다
- 바깥쪽 `ListField`:
  - `items={form.sections}`
  - `newItem={{ id: Date.now(), heading: '', categories: ['전체'], items: [] }}` (id 생성 방식은 기존 캐릭터 아이템의 `id: Date.now()` 관례와 통일)
  - `addLabel="섹션 추가"`
  - `reorderable` 켜서 섹션 순서도 드래그로 변경 가능
- 안쪽 카테고리/캐릭터 `ListField` 두 블록은 내용 변경 없이 그대로 안으로 이동 (`ListField`가 이미 사진 리스트 중첩을 지원하므로 3단 중첩도 문제 없음)
- 섹션 삭제는 `ListField` 기본 제공 "삭제" 버튼 그대로 사용

`AdminDashboard.jsx`는 변경 없음 (내부 데이터 shape에 무관하게 `data`를 그대로 `Form`에 전달하고 `onSave`로 그대로 저장하는 구조라서).

---

## 5. 테스트

- `CharacterSectionBlock.test.jsx` (신규) — 기존 `CharactersSection.test.jsx`가 검증하던 내용(필터, 카드 클릭 → 모달, 카테고리 전환 등)을 이 컴포넌트 단위로 이전
- `CharactersSection.test.jsx` — "여러 섹션을 순서대로 렌더링한다", "섹션이 없으면(빈 배열) 아무것도 안 그린다" 정도의 얇은 컨테이너 테스트만 남김
- `Navbar.test.jsx` (신규 또는 확장) — 섹션 배열 기반으로 nav 항목이 동적 생성되는지, 섹션이 0개/여러 개일 때 각각 검증
- `CharactersForm.jsx`는 기존 관례대로 전용 테스트 파일 없이 전체 스위트 + `npm run build`로 검증

---

## 6. 에러 처리

- `data.sections`가 없거나 빈 배열이면 공개 페이지엔 아무것도 렌더링하지 않는다 (지금 `loading || !data` 처리와 동일한 수준 — 별도 에러 UI 없음, 기존 패턴 유지)
- 마이그레이션 SQL 실행 실패/부분 실패에 대한 롤백 절차는 이 spec 범위 밖 — 실행 전 Supabase 대시보드에서 해당 행 백업(값 복사) 권장 정도로 충분 (개인 프로젝트 규모)
