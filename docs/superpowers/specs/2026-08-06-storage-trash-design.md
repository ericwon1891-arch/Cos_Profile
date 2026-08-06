# 스토리지 파일 삭제(휴지통) 기능 설계

## 배경 / 문제

관리자가 사진을 교체하면 이전 파일이 Supabase Storage에 그대로 남는다(업로드/교체 시 이전 파일 삭제는 [[2026-08-05-korean-filename-fix-storage-usage-design.md]]에서 범위 밖으로 명시적으로 제외했었다). "스토리지 사용량" 화면([[2026-08-06-storage-usage-thumbnail-design.md]])에서 이런 남은 파일을 확인할 수는 있지만 지울 방법이 없다.

## 목표

1. 관리자가 스토리지의 파일(하나 또는 여러 개)을 삭제할 수 있다.
2. 삭제는 즉시 영구 삭제가 아니라 휴지통으로 이동되며, 14일간 보관 후 자동으로 영구 삭제된다.
3. 휴지통에 있는 파일은 복원하거나 즉시 영구 삭제할 수 있다.

## 범위 밖

- 진짜 "시간이 되면 자동으로" 실행되는 서버 스케줄러(pg_cron, Edge Function) — 이 프로젝트는 서버 코드 없는 순수 프론트엔드 + Supabase 구조를 유지하기로 했다(사용자 확인 완료). 대신 관리자가 "스토리지 사용량" 화면을 열 때마다 14일 지난 항목을 정리하는 지연 청소(lazy cleanup) 방식을 쓴다. 관리자가 오래 접속하지 않으면 만료된 파일이 실제로는 더 오래 남아있을 수 있다는 트레이드오프를 감수한다.
- "휴지통 비우기"(전체 일괄 영구삭제) 버튼, 휴지통 항목 다중 선택 — 요청받지 않았으므로 다루지 않는다. 휴지통 항목은 1개씩 복원/영구삭제한다.
- 업로드/교체 시 자동으로 이전 파일을 휴지통에 넣는 것 — 이번 요청은 "스토리지 사용량 화면에서 수동으로 지우는" 기능이며, 업로드 흐름 자체를 바꾸지 않는다.

## 아키텍처

새 DB 테이블을 추가하지 않는다. `media` 버킷 안에 `trash/` 폴더를 두고, 삭제 = `trash/` 폴더로 이동(`storage.move()`), 복원 = 원래 경로로 다시 이동, 영구 삭제 = `storage.remove()`로 정의한다. "며칠 지났는지"는 Supabase Storage가 이동 시 자동 갱신하는 객체 메타데이터의 `updated_at`을 그대로 사용한다(별도 타임스탬프 저장 불필요).

`supabase.storage.from('media').list(path, opts)`는 지정한 폴더 한 단계만 조회하고 하위 폴더까지 재귀적으로 훑지 않는다. 따라서:
- 루트 목록(`list('', ...)`)에는 `trash` 폴더 자체가 이름만 있고 `metadata`/`id`가 없는 플레이스홀더 항목으로 나타난다. 이런 폴더 플레이스홀더(`id === null`)는 모든 목록·합계 계산에서 제외한다.
- 휴지통 목록은 별도로 `list('trash', ...)`를 호출해서 가져온다.
- 총 사용량(`총 사용량`, `한도 대비 사용률`)은 루트 파일 + 휴지통 파일의 크기를 합산한다(휴지통도 실제로 용량을 차지하므로).

## DB 마이그레이션 (등급 상 — 프로덕션 DB 변경, 적용 전 사용자 확인 필수)

`media` 버킷에는 현재 `INSERT`(업로드), `SELECT`(목록조회) 정책만 있다. 파일 이동과 영구 삭제를 위해 `authenticated` 역할 한정으로 2개를 추가한다.

`supabase/update-storage-trash.sql`:
```sql
-- 스토리지 사용량 화면에서 파일을 휴지통(trash/ 폴더)으로 옮기거나(UPDATE)
-- 영구 삭제(DELETE)할 수 있도록 authenticated 역할에 한정해 권한을 부여.
create policy "media authenticated move" on storage.objects
  for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
```

## 유틸리티 함수 (`src/lib/storageUsage.js`에 추가)

- `TRASH_PREFIX = 'trash/'`
- `TRASH_RETENTION_DAYS = 14`
- `isFolderPlaceholder(file): boolean` — `file.id === null`이면 `true` (list() 결과의 폴더 플레이스홀더 항목 판별)
- `stripTrashPrefix(name: string): string` — `trash/1700000000000.jpg` → `1700000000000.jpg` (화면 표시용 원래 이름)
- `daysUntilExpiry(updatedAt: string, now?: number): number` — `TRASH_RETENTION_DAYS`에서 `updatedAt` 이후 경과일을 뺀, 남은 보관일(음수면 만료됨). `now` 생략 시 `Date.now()`
- `isExpired(updatedAt: string, now?: number): boolean` — `daysUntilExpiry(...) <= 0`

## 컴포넌트 설계

`StorageUsage.jsx`(컨테이너)는 루트 파일 목록과 휴지통 목록을 각각 `fetchAllStorageFiles`로 가져와 상태로 들고, 총계를 계산해 하위 컴포넌트에 넘긴다. 렌더링은 두 개의 새 프레젠테이션 컴포넌트로 분리한다.

**`src/components/admin/sections/StorageFileList.jsx`** (신규) — "전체 파일 보기" 섹션
- Props: `files: Array<{name, size}>`(용량 내림차순 정렬은 부모가 전달), `onDelete: (names: string[]) => Promise<void>`
- 각 행에 체크박스 + 썸네일(`getPublicUrl` 활용, 기존 Top 10과 동일한 패턴) + 파일명 + 크기 표시
- 1개 이상 선택 시 "선택 삭제(N)" 버튼 노출 → `confirm()` 대화상자("선택한 N개 파일을 휴지통으로 이동할까요?") → 확인 시 `onDelete(선택된 이름 배열)` 호출 후 선택 상태 초기화

**`src/components/admin/sections/StorageTrash.jsx`** (신규) — "휴지통" 섹션
- Props: `files: Array<{name, size, updatedAt}>`, `onRestore: (name: string) => Promise<void>`, `onPermanentDelete: (name: string) => Promise<void>`
- 각 행에 썸네일 + 원래 파일명(`stripTrashPrefix`) + 크기 + "N일 후 영구 삭제"(`daysUntilExpiry`) + "복원"/"지금 영구 삭제" 버튼
- "지금 영구 삭제"는 `confirm()` 대화상자로 재확인 후 호출

**`StorageUsage.jsx`(컨테이너) 변경**
- 마운트 시 루트(`list('')`)와 휴지통(`list('trash')`) 목록을 함께 조회
- 조회 직후, 휴지통 목록 중 `isExpired(updatedAt)`인 항목을 먼저 `storage.remove()`로 영구 삭제하고 나머지만 상태에 반영(지연 청소)
- `onDelete(names)`: 각 이름에 대해 `storage.move(name, TRASH_PREFIX + name)` 호출 후 재조회(`reloadToken` 증가)
- `onRestore(trashName)`: `storage.move(trashName, stripTrashPrefix(trashName))` 호출 후 재조회
- `onPermanentDelete(trashName)`: `storage.remove([trashName])` 호출 후 재조회
- 기존 "용량 큰 파일 Top 10"은 그대로 유지(루트 파일 기준, 폴더 플레이스홀더 제외)

## 에러 처리

이동/삭제 API 호출이 실패하면 [[2026-08-06-upload-error-message-design.md]]에서 만든 `classifyUploadError`와 동일한 패턴으로 `alert()`에 사람이 읽을 수 있는 메시지를 띄운다. RLS 정책이 아직 적용되지 않은 상태에서 시도하면 "로그인이 만료되었습니다..." 문구가 뜨게 되므로, DB 마이그레이션 적용 전에는 이 기능이 정상 동작하지 않는다는 점을 구현 계획에 명시한다.

## 테스트 계획

- `storageUsage.js`: `isFolderPlaceholder`, `stripTrashPrefix`, `daysUntilExpiry`, `isExpired`에 대한 단위 테스트(경계값: 정확히 14일째, 13일째, 15일째).
- `StorageFileList.jsx`: 체크박스 선택/해제, "선택 삭제" 버튼이 선택된 개수만큼만 노출되는지, `confirm()` mock 후 `onDelete`가 올바른 이름 배열로 호출되는지.
- `StorageTrash.jsx`: 남은 보관일 표시, "복원"/"지금 영구 삭제" 클릭 시 각각 `onRestore`/`onPermanentDelete`가 올바른 인자로 호출되는지.
- `StorageUsage.jsx`: `move`/`remove` mock을 이용해 만료된 휴지통 항목이 마운트 시 자동으로 영구 삭제되는지, 삭제/복원 후 재조회가 일어나는지, 총 사용량이 루트+휴지통 합산인지.
