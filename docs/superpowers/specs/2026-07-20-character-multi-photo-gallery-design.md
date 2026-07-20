# 캐릭터 다중 사진 갤러리 — 설계

## 배경

대표 캐릭터(`characters` 섹션) 항목은 현재 `photo` 타입일 때 `thumbnail`(카드 대표 사진)과 `src`(모달에서 보여주는 사진 한 장)만 지원한다. 한 캐릭터에 여러 장의 사진을 올려서 모달에서 넘겨보게 하고 싶다.

## 데이터 모델

`characters.items[]`에 `photos: string[]` 필드를 신규 추가한다.

- `thumbnail`: 그리드 카드에 보이는 대표 사진. 기존 그대로 유지, `photos`와는 독립적인 필드.
- `photos`: 모달에서 넘겨보는 갤러리용 사진 URL 배열. 신규 필드.
- 대표 사진을 갤러리에도 포함하고 싶으면 관리자가 `photos`에 같은 URL을 한 번 더 추가한다 (자동 병합하지 않음).
- 기존 데이터(구 캐릭터, `photos` 필드 없음)와의 호환: 모달은 `photos`가 비어있거나 없으면 `[work.src]`로 대체해서 기존과 동일하게 사진 한 장만 보여준다. 별도 마이그레이션 불필요.

`type`이 `youtube`/`local`(영상)인 항목에는 적용하지 않는다.

## 관리자 페이지 (`CharactersForm.jsx`)

- 캐릭터 리스트 항목의 새 기본값에 `photos: []` 추가.
- 기존 "사진"(대표 사진) `ImageField`는 그대로 유지.
- 그 아래 "갤러리 사진" 라벨로 `ListField`를 중첩 추가 — `newItem: ''`, `renderItem`에서 `ImageField`로 각 URL을 업로드/표시. 기존 `categories` 리스트와 동일한 문자열 리스트 패턴.
- 추가/삭제 + 마우스 드래그로 순서 변경 지원 (아래 "순서 드래그 정렬" 참고).

### 순서 드래그 정렬

- `ListField.jsx`에 opt-in `reorderable` prop 추가 (기본 `false`). 다른 리스트(카테고리, 캐릭터, 링크 등)는 그대로 영향 없음 — 갤러리 사진 리스트에만 `reorderable` 전달.
- `reorderable`일 때 각 항목 래퍼에 `draggable="true"` + 드래그 핸들(⠿ 아이콘, `cursor-grab`)을 추가.
- 네이티브 HTML5 Drag and Drop API만 사용 (`onDragStart`/`onDragOver`/`onDrop`), 외부 라이브러리 없음.
  - `onDragStart(index)`: 드래그 중인 인덱스를 컴포넌트 상태로 저장.
  - `onDragOver(index)`: `preventDefault()`로 드롭 허용.
  - `onDrop(index)`: 저장해둔 인덱스를 드롭 위치로 이동시켜 배열 재정렬 후 `onChange` 호출.
- 관리자 페이지는 데스크톱에서만 쓸 예정이라 **터치 드래그(모바일)는 지원하지 않음** — HTML5 Drag and Drop API는 터치 이벤트를 발생시키지 않으므로 모바일에서는 자연히 드래그가 동작하지 않고(삭제 버튼으로는 여전히 관리 가능), 별도 터치 이벤트 처리나 폴백은 구현하지 않는다.

## 공개 페이지

- `WorkCard.jsx`: 변경 없음 (`thumbnail` 계속 사용).
- `CharactersSection.jsx`: `PhotoModal`에 `key={selectedWork.id}` 추가해 캐릭터가 바뀔 때 모달 내부 인덱스 상태가 초기화되도록 한다.
- `PhotoModal.jsx`:
  - `photos = work.photos?.length ? work.photos : [work.src].filter(Boolean)` 계산.
  - `useState`로 현재 인덱스 관리 (기본 0).
  - `photos.length > 1`일 때만 좌우 화살표 버튼과 `현재 / 전체` 카운터를 표시.
  - 화살표는 배열 끝에서 순환(loop)하지 않고 양 끝에서 비활성화(disabled) — 범위를 벗어나지 않게.
  - 키보드 좌우 화살표 탐색은 범위 밖.

## 테스트 계획

- `PhotoModal.test.jsx`: 사진 1장일 때 화살표/카운터 미표시 유지 확인(기존 테스트 통과), 사진 여러 장일 때 화살표 클릭으로 인덱스 이동 및 카운터 표시 테스트 추가, `photos` 없이 `src`만 있는 레거시 케이스 테스트 추가.
- `CharactersSection.test.jsx`: 기존 테스트는 `photos` 필드 없이도 통과해야 함 (하위 호환 확인).
- `ListField.test.jsx` 신규 작성: `reorderable=false`(기본값)일 때 드래그 핸들 미표시(기존 동작 무변경) 확인, `reorderable=true`일 때 드래그 핸들 표시 + `dragStart`→`drop` 시뮬레이션으로 배열 순서가 바뀌어 `onChange`가 올바른 순서로 호출되는지 확인.
- `CharactersForm.jsx`의 갤러리 리스트 UI(실제 드래그 조작 포함)는 수동 검증.

## 범위 밖

- 모달 키보드 좌우 화살표 탐색
- 영상 타입(youtube/local) 다중 미디어 지원
- 모바일 터치 드래그 정렬 (관리자 페이지는 데스크톱 전용 사용 전제)
