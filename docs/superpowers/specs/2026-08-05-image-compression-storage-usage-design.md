# 이미지 자동 압축 + 스토리지 사용량 관리자 메뉴 설계

## 배경 / 문제

관리자가 사진을 업로드할 때 파일 용량이 커서 일부 사진을 올리지 못하는 문제가 있다. `ImageField.jsx`에는 이미 413(Payload Too Large) 에러를 감지해 안내 메시지를 보여주는 코드가 있어, 실제로 겪고 있는 문제로 보인다.

Supabase 대시보드에서 실측한 결과:
- 요금제: **Free Plan**
- 스토리지 한도: **1GB**
- 현재 사용량: **약 5MB (1% 미만)**

즉 전체 스토리지 쿼터가 부족한 상황은 아니며, **개별 파일 하나의 용량이 커서 업로드 요청이 거절**되는 문제로 판단된다. 리사이징 기능은 이 문제를 직접 해결한다. 스토리지 사용량 관리자 메뉴는 앞으로 용량이 누적되는 것을 모니터링하기 위한 용도로 별도 추가한다.

## 목표

1. 관리자가 사진을 업로드하면 브라우저에서 자동으로 압축한 뒤 Supabase Storage에 올라가게 한다.
2. 이미 업로드되어 있는 기존(미압축) 사진을 관리자가 화면에서 개별적으로 재압축할 수 있게 한다.
3. 이미지 교체/재압축 시 이전 파일이 스토리지에 orphan으로 남지 않도록 정리한다.
4. 관리자 메뉴에 스토리지 전체 사용량(용량, 한도 대비 비율, 용량 큰 파일 목록)을 보여준다.

## 범위 밖

- 비디오 파일(`localVideoSrc`) 압축/트랜스코딩은 다루지 않는다. 이번 기능은 이미지(`ImageField`)에만 적용한다.
- 이미지 크롭/리사이즈(해상도 축소)는 하지 않는다. 원본 해상도와 가로세로 비율은 그대로 유지하고, JPEG 재인코딩(quality 80%)으로만 용량을 줄인다.
- 실제 요금제 변경/업그레이드는 다루지 않는다.

## 아키텍처 결정: 스토리지 사용량 조회 방식

`supabase.storage.list()`를 관리자 화면에서 직접 호출하는 방식(클라이언트 전용)을 택한다. Edge Function을 새로 도입하는 대안도 있었지만, 이 프로젝트는 서버 코드 없이 순수 프론트엔드 + Supabase(BaaS)로 구성되어 있어 기존 아키텍처와 어긋난다. `storage.objects`에 대한 SELECT/DELETE 권한을 `authenticated` 역할에만 부여하는 RLS 정책을 추가해, 로그인한 관리자만 목록 조회/삭제가 가능하게 한다 (기존 보안 강화 마이그레이션에서 익명 목록 조회를 막았던 원칙은 유지).

## 공통 압축 유틸리티

`src/lib/imageCompression.js`

```js
export async function compressImage(fileOrBlob, { quality = 0.8 } = {}) { ... }
```

- `createImageBitmap`으로 원본을 디코드하고, 같은 픽셀 크기의 `<canvas>`에 그린 뒤 `canvas.toBlob('image/jpeg', quality)`로 재인코딩한다.
- 리사이즈(축소)나 크롭은 하지 않는다 — 원본 해상도·가로세로 비율 그대로 유지.
- 입력 포맷(PNG 포함)과 관계없이 출력은 항상 JPEG다. 대표 캐릭터 갤러리 사진 등은 투명 배경이 필요 없으므로 이 변환은 안전하다.
- 새 업로드 압축과 기존 사진 재압축 버튼 양쪽에서 이 함수를 공유한다.

## 압축 상태 표시 및 파일 정리

**압축 여부 판별**: 압축을 거친 파일은 스토리지 경로에 `c_` 접두사를 붙인다 (예: `c_1755000000000-photo.jpg`). `ImageField`는 현재 `value`(공개 URL)의 파일명이 `c_`로 시작하는지만 보고 압축 여부를 판단한다. 별도 DB 컬럼/스키마 변경 없이 파일명 규칙만으로 충분하다.

**`ImageField` 동작 변경** (`src/components/admin/fields/ImageField.jsx`):
- 이미지가 있을 때 상태 배지를 보여준다: `압축됨` (파일명이 `c_`로 시작) / `원본(미압축)`.
- `원본(미압축)`일 때만 **재압축** 버튼을 노출한다. 클릭 시:
  1. 현재 `value` URL을 `fetch`해 Blob으로 가져온다.
  2. `compressImage`로 압축한다.
  3. `c_{Date.now()}-{원본파일명}` 경로로 새로 업로드한다.
  4. 업로드 성공 시 이전(미압축) 파일을 `supabase.storage.from('media').remove([이전경로])`로 삭제한다.
  5. `onChange(새 공개 URL)`을 호출해 폼 상태를 갱신한다 (기존 폼의 저장 버튼으로 최종 반영되는 기존 흐름과 동일).
- **새 파일 업로드**(`<input type="file">` 선택) 시에도 동일하게 적용한다: 선택한 파일을 `compressImage`로 압축 → `c_` 접두사 경로로 업로드 → **이전에 값이 있었다면(교체 케이스) 이전 파일 삭제** → `onChange(새 URL)`. 이는 기존에 이미지 교체 시 이전 파일을 삭제하지 않아 매번 파일이 쌓이던 문제(코드 리뷰 중 발견)를 함께 해결한다.
- 업로드/재압축 중에는 버튼을 비활성화하고 진행 상태를 표시해 중복 클릭을 막는다.
- 압축이나 삭제 중 오류가 나도 사용자 흐름이 끊기지 않도록, 삭제 실패는 조용히 무시(로그만 남김)하고 업로드 성공 자체는 그대로 반영한다 — 이전 파일 삭제는 부가 정리 작업이지 핵심 기능이 아니기 때문이다.

## 스토리지 사용량 관리자 메뉴

**`AdminDashboard.jsx` 변경**: `SECTIONS`에 항목 추가, `NO_CONTENT_KEYS`에도 포함 (기존 `analytics`, `account`와 동일 패턴).

```js
{ key: 'storage', label: '스토리지 사용량' }
```

**새 컴포넌트**: `src/components/admin/sections/StorageUsage.jsx`

- `supabase.storage.from('media').list('', { limit: 1000, sortBy: { column: 'name' } })`로 `media` 버킷의 전체 파일과 `metadata.size`를 가져온다. 파일이 1000개를 넘을 경우 `offset`을 늘려가며 반복 조회한다 (현재 규모상 발생 가능성은 낮지만 정확성을 위해 처리).
- 전체 사용량 합계를 MB/GB 단위로 계산하고, `STORAGE_LIMIT_GB = 1` (Free Plan 실측값) 상수 대비 사용률(%)을 표시한다. 상수 옆에 "요금제 변경 시 이 값을 수정하세요" 주석을 남긴다.
- 용량이 큰 파일 Top 10을 파일명 + 크기로 목록 표시한다 (어떤 파일부터 정리할지 판단하는 용도).
- 로딩/에러 상태는 `VisitorAnalytics.jsx`와 동일한 패턴(로딩 텍스트, 에러 시 "다시 시도" 버튼)을 따른다.

## DB 마이그레이션

`supabase/update-storage-management.sql`

```sql
-- 관리자(authenticated)가 스토리지 사용량 조회를 위해 파일 목록을 볼 수 있도록 허용.
-- 기존 보안 강화 마이그레이션은 익명(anon) 목록 조회만 막았을 뿐이므로,
-- authenticated로 범위를 한정해 다시 추가해도 원래 취지에 어긋나지 않는다.
create policy "media authenticated list" on storage.objects
  for select to authenticated using (bucket_id = 'media');

-- 재압축/이미지 교체 시 이전 파일을 정리하기 위해 필요.
create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
```

## 에러 처리

- 압축 자체가 실패하는 경우(디코딩 불가 등): 원본 파일을 그대로 업로드하고 사용자에게 "압축에 실패해 원본으로 업로드했습니다" 안내. (업로드 자체를 막지 않는다.)
- 업로드 413 에러: 기존 안내 메시지 유지. 압축 후에도 413이 발생하면(극단적으로 큰 원본) 동일 메시지를 보여준다.
- 재압축 중 fetch/업로드 실패: 기존 이미지는 그대로 유지하고 실패 메시지만 보여준다 (부분 실패로 이미지가 사라지는 일이 없게 한다).
- 스토리지 사용량 조회 실패: `VisitorAnalytics`와 동일하게 에러 메시지 + 다시 시도 버튼.

## 테스트 계획

프로젝트의 테스트 원칙(상호작용/로직이 있는 컴포넌트만 테스트, Supabase는 mock 처리)을 따른다.

- `imageCompression.js`: 순수 로직 유닛 테스트가 어렵다면(Canvas/`createImageBitmap`은 jsdom에서 제한적) 최소한 파일명 압축 여부 판별(`c_` 접두사 체크) 같은 순수 함수는 분리해 유닛 테스트한다.
- `ImageField.jsx`: 압축됨/원본 배지 표시 분기, 재압축 버튼 노출 조건, 업로드/재압축 시 `supabase.storage` 관련 함수 호출(mock)이 올바른 인자로 이루어지는지 테스트.
- `StorageUsage.jsx`: `list()` mock 응답을 기반으로 총 사용량 계산, 사용률(%) 계산, Top 10 정렬 로직을 테스트.
