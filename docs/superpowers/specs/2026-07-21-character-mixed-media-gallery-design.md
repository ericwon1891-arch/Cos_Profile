# 캐릭터 사진+영상 혼합 갤러리 — 설계

## 배경

캐릭터 항목은 현재 `type`(photo/youtube/local) 필드로 사진 전용 또는 영상 전용 중 하나만 고를 수 있다. 하나의 캐릭터에 사진과 유튜브 영상을 함께 올려서, 갤러리처럼 넘겨보다가 마지막에 영상이 나오게 하고 싶다. 영상은 용량 문제로 대부분 유튜브를 쓰고, 유튜브 영상은 재생 시작 시점(초)을 지정할 수 있어야 한다.

## 데이터 모델

`characters.items[]`에 다음 필드를 사용한다 (기존 `photos`/`thumbnail` 유지, 신규 필드 추가):

- `photos: string[]` — 갤러리 사진. 모든 캐릭터의 기본/필수 콘텐츠 (폼에서 강제 검증은 하지 않음, 라벨로만 안내).
- `thumbnail: string` — 카드 대표 사진. 기존 그대로, `photos`와 독립.
- `youtubeId?: string` — 유튜브 영상 ID (선택). 기존 필드 재사용.
- `youtubeStart?: number` — 유튜브 재생 시작 시간(초, 선택). 신규 필드. `youtubeId`가 있을 때만 의미 있음.
- `localVideoSrc?: string` — 로컬 영상 파일 URL (선택, 신규 필드). `youtubeId`가 없을 때만 사용.
- `type`, `src` (기존 필드) — 관리자 폼에서 더 이상 편집하지 않지만, 이 기능 이전에 만들어진 기존 데이터의 하위 호환 폴백에만 조용히 사용한다 (아래 "슬라이드 구성 규칙" 참고). 새로 만드는 캐릭터에는 `type`/`src`를 쓰지 않는다.

### 슬라이드 구성 규칙 (공개 페이지가 소비하는 로직)

한 캐릭터의 "슬라이드 목록"은 다음 순서로 구성한다:

1. **사진 슬라이드**: `photos`가 비어있지 않으면 `photos`를 그대로 사용. `photos`가 비어있고 `type === 'photo'`이면(레거시 사진 전용 캐릭터) `[src]`로 대체. 그 외에는 사진 슬라이드 없음.
2. **영상 슬라이드** (있다면 항상 맨 마지막 1개):
   - `youtubeId`가 있으면 `{ kind: 'youtube', id: youtubeId, start: youtubeStart }`.
   - 없고 `localVideoSrc`가 있으면 `{ kind: 'local', src: localVideoSrc }`.
   - 둘 다 없고 `type === 'local'`이고 `src`가 있으면(레거시 영상 전용 캐릭터) `{ kind: 'local', src }`.
   - 그 외에는 영상 슬라이드 없음.

이 규칙으로 마이그레이션 없이 다음이 모두 자연스럽게 동작한다: 기존 사진 전용 캐릭터, 기존 영상 전용 캐릭터(유튜브/로컬), 신규 사진만 있는 캐릭터, 신규 사진+영상 혼합 캐릭터.

## 관리자 페이지 (`CharactersForm.jsx`)

- "타입 (photo/youtube/local)" `TextField` 삭제. `newItem` 기본값에서도 `type`/`src` 제거 (더 이상 채우지 않음).
- 필드 순서: 캐릭터/작품명 → 카테고리 → 대표 사진(`thumbnail`) → 갤러리 사진(`photos`, 기존 `reorderable` `ListField` 유지, 라벨을 "필수 콘텐츠"로 갱신) → 유튜브 영상 ID(선택) → 시작 시간(초, 선택) → 로컬 영상 파일 URL(선택, 유튜브 없을 때만).
- 시작 시간은 숫자 입력이며 `youtubeStart`에 숫자로 저장한다 (빈 문자열이면 저장 시 `undefined`/생략).

## 공개 페이지

- **모달 통합**: `VideoModal.jsx`를 삭제하고, 그 렌더링 로직(유튜브 iframe / `<video>` 태그)을 기존 `PhotoModal.jsx`(다중 사진 갤러리 모달, 지난 기능에서 구현됨) 안의 "영상 슬라이드" 렌더 분기로 흡수한다. `PhotoModal`은 이제 사진과 영상이 섞인 슬라이드 배열을 순회하는 범용 모달이 된다.
- `CharactersSection.jsx`: `type`에 따라 `PhotoModal`/`VideoModal` 중 하나를 고르던 분기를 제거하고, 항상 같은 모달 하나만 렌더링한다.
- `PhotoModal.jsx`: "슬라이드 구성 규칙"대로 슬라이드 배열을 만들고, 현재 슬라이드가 `{kind:'image', url}`이면 기존처럼 `<img>`를, `{kind:'youtube', id, start}`이면 유튜브 iframe(`start` 파라미터 포함)을, `{kind:'local', src}`이면 `<video>` 태그를 렌더링한다. 좌우 화살표/카운터는 슬라이드가 2개 이상일 때만 표시 (기존 로직 그대로, 사진/영상 구분 없이 슬라이드 개수로 판단).
- `WorkCard.jsx`: 재생 아이콘 표시 조건을 `work.type === 'youtube'/'local'` 대신, "영상 슬라이드가 존재하는가"(`youtubeId` 또는 `localVideoSrc` 또는 레거시 `type==='local' && src`)로 바꾼다. 영상이 하나라도 있으면 재생 아이콘, 없으면 사진 아이콘.

## 유튜브 시작 시간

iframe embed URL에 `&start=N`을 추가한다: `https://www.youtube.com/embed/{id}?autoplay=1&start={youtubeStart}` (`youtubeStart`가 없으면 `&start=` 부분 생략, 기존과 동일하게 0초부터 재생).

## 범위 밖

- 로컬 영상 파일에 대한 시작 시간 지정 (유튜브만 지원)
- 사진/영상 슬라이드 개수 제한
- 유튜브 링크(URL) 붙여넣기로 ID/시작시간 자동 파싱 (관리자가 ID와 초를 직접 입력하는 방식으로 확정)
