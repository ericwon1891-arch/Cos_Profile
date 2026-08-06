# 미사용 파일 배지(게시된 사진 vs 업로드된 사진 비교) 설계

## 배경 / 문제

"스토리지 사용량" 화면의 "전체 파일 보기"([[2026-08-06-storage-trash-design.md]])는 버킷에 있는 모든 파일을 보여주지만, 그중 실제로 사이트에 게시되어 쓰이고 있는 파일과 더 이상 어디서도 참조되지 않는 파일을 구분할 방법이 없다. 관리자가 어떤 파일을 휴지통으로 보내도 안전한지 판단하기 어렵다.

## 목표

"전체 파일 보기" 목록에서, 사이트 콘텐츠(`site_content` 테이블) 어디에서도 참조되지 않는 파일에 "미사용" 배지를 표시한다.

## 범위 밖

- 깨진 링크(참조는 있지만 실제 파일이 없는 경우) 탐지 — 이번 요청은 "미사용 업로드 파일" 확인이며, 반대 방향(콘텐츠 무결성 검사)은 다루지 않는다.
- 별도의 새 관리자 메뉴 — 기존 "스토리지 사용량 > 전체 파일 보기"에 배지만 추가한다.

## 아키텍처

`site_content` 테이블은 `section`별로 임의 구조의 JSONB `data`를 담고 있고(SELECT는 공개 정책으로 인증 없이도 가능), 이미지 URL은 `ImageField`가 만든 `getPublicUrl()` 결과(`.../storage/v1/object/public/media/<path>`) 형태로 그 안 어딘가에 문자열로 박혀 있다. 섹션마다 구조가 달라 필드를 하나하나 아는 대신, `data`를 통째로 `JSON.stringify`한 뒤 정규식으로 `media/` 이후의 경로를 전부 추출하는 방식을 쓴다(중첩 객체/배열 구조를 몰라도 안전하게 전체 커버).

`StorageUsage.jsx`는 루트/휴지통 스토리지 목록 조회와 함께 `site_content` 전체 행을 조회해 "게시된 파일 경로 집합"(`usedPaths`)을 계산하고, 이를 `StorageFileList`에 넘긴다. `site_content` 조회가 실패하면 기존 스토리지 조회 실패와 동일하게 에러 상태(재시도 버튼)로 처리한다.

## 유틸리티 함수 (`src/lib/mediaUsage.js`, 신규 파일)

- `extractMediaPaths(data: unknown): string[]` — `data`(임의의 JSON 값, null/undefined 허용)를 문자열화해 `/storage/v1/object/public/media/<path>` 패턴을 전부 찾아 `<path>` 부분만 배열로 반환한다.

## 컴포넌트 변경

**`StorageUsage.jsx`**: 기존 루트/휴지통 `Promise.all` 조회에 `supabase.from('site_content').select('data')` 조회를 추가한다. 응답의 각 행에 `extractMediaPaths`를 적용해 결과를 모두 합친 `Set<string>`을 `usedPaths`로 만들어 상태에 저장하고 `StorageFileList`에 prop으로 전달한다.

**`StorageFileList.jsx`**: `usedPaths: Set<string>`(기본값 빈 Set) prop을 추가로 받는다. 각 파일 행에서 `!usedPaths.has(f.name)`이면 파일명 옆에 작은 "미사용" 배지(주황 계열 텍스트+테두리)를 표시한다. 체크박스/썸네일/선택삭제 동작은 변경하지 않는다.

## 에러 처리

`site_content` 조회 실패는 기존 스토리지 조회 실패와 동일한 에러 상태(“데이터를 불러오지 못했습니다” + 다시 시도 버튼)로 합쳐서 처리한다 — 화면을 이원화하지 않는다.

## 테스트 계획

- `mediaUsage.js`: 중첩 객체/배열 안의 media URL을 모두 추출하는지, media URL이 아닌 문자열은 무시하는지, `data`가 `null`/`undefined`/빈 객체일 때 빈 배열을 반환하는지 단위 테스트.
- `StorageFileList.jsx`: `usedPaths`에 없는 파일에는 "미사용" 배지가, 있는 파일에는 배지가 없는지 테스트. `usedPaths`를 생략해도 기본값(빈 Set)으로 정상 동작(전부 미사용 처리)하는지 테스트.
- `StorageUsage.jsx`: `site_content` mock 응답을 기반으로 `usedPaths`가 올바르게 계산되어 `StorageFileList`에 미사용 배지로 반영되는지, `site_content` 조회 실패 시 기존 에러 상태로 전환되는지 테스트.
