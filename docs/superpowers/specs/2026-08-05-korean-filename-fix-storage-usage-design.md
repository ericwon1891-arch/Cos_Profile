# 한글 파일명 업로드 오류 수정 + 스토리지 사용량 관리자 메뉴 설계

## 배경 / 문제

관리자가 사진을 업로드할 때 일부 파일이 실패하는 문제가 있었다. 처음에는 "파일 용량이 커서 스토리지가 꽉 차 못 올라간다"고 가정하고 자동 이미지 압축(리사이징) 기능을 설계했으나, Supabase 대시보드/로그를 직접 확인한 결과 그 가정이 틀렸음이 드러났다.

**실측 결과**
- 요금제: Free Plan, 스토리지 한도 1GB, 현재 사용량 약 5MB(1% 미만) — 전체 쿼터는 전혀 문제가 아니다.
- 테스트로 올린 10MB 영문 파일명 이미지는 정상 업로드됨(200) — 파일 용량 자체는 문제가 아니다.
- 버킷의 "Restrict file size" 옵션도 꺼져 있어 크기 제한이 걸려있지 않다.
- 실제 실패 로그(Storage Logs)에서 원인을 확인: `SIH_0026-편집.jpg`, `SIH_0011-편집.jpg` 업로드가 `400 Bad Request`, `error.errorCode: "InvalidKey"`, `"Invalid key: 1785899957159-SIH_0026-편집.jpg"`로 거부됨.

**근본 원인**: `src/components/admin/fields/ImageField.jsx`의 업로드 경로 생성 코드가 원본 파일명을 그대로 스토리지 키에 사용한다.

```js
const path = `${Date.now()}-${file.name}`
```

Supabase Storage는 객체 키에 한글 등 비-ASCII 문자가 들어가면 `InvalidKey` 400 에러로 업로드 자체를 거부한다. 보정 앱 등에서 "-편집"처럼 한글이 붙은 파일명으로 저장된 사진을 올릴 때 이 문제가 발생한다.

**이전 설계와의 차이**: 자동 이미지 압축/리사이징, 기존 사진 재압축 버튼, 업로드 시 이전 파일 삭제(orphan 정리)는 모두 "스토리지 용량 부족"이라는 잘못된 가정에 기반한 것이었으므로 이번 계획에서 전부 제외한다.

## 목표

1. 파일명에 한글 등 비-ASCII 문자가 있어도 업로드가 실패하지 않게 한다.
2. 관리자 메뉴에 스토리지 전체 사용량(용량, 한도 대비 비율, 용량 큰 파일 목록)을 보여준다.

## 범위 밖

- 이미지 압축/리사이징, 재압축 기능 — 이번 문제와 무관하므로 다루지 않는다.
- 업로드/교체 시 이전 파일 삭제(orphan 정리) — 별도 요청이 있을 때 다룬다.
- 비디오 파일 처리 — 대상 아님.

## 1. 한글 파일명 업로드 오류 수정

**변경 대상**: `src/components/admin/fields/ImageField.jsx`

원본 파일명을 스토리지 키에서 완전히 제거하고, 타임스탬프 + 확장자만으로 경로를 생성한다.

```js
const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg'
const path = `${Date.now()}.${ext}`
```

- 한글뿐 아니라 공백·특수문자·이모지 등 어떤 문자가 파일명에 들어있어도 영향받지 않아 근본적으로 안전하다.
- 관리자가 파일명만 보고 원본을 구분할 일이 없으므로(미리보기 이미지로 확인) 원본 파일명을 버려도 기능상 손실이 없다.
- 확장자가 없는 파일은 `jpg`로 폴백한다(현재 `accept="image/*"`로 이미지 파일만 선택 가능하므로 발생 가능성은 낮지만 방어적으로 처리).

## 2. 스토리지 사용량 관리자 메뉴

**아키텍처 결정**: `supabase.storage.list()`를 관리자 화면에서 직접 호출하는 방식(클라이언트 전용)을 택한다. 이 프로젝트는 서버 코드 없이 순수 프론트엔드 + Supabase(BaaS)로 구성되어 있으므로 Edge Function 같은 새 구성요소를 도입하지 않는다. `storage.objects`에 대한 SELECT 권한을 `authenticated` 역할에만 부여하는 RLS 정책을 추가해, 로그인한 관리자만 목록 조회가 가능하게 한다(기존 보안 강화 마이그레이션에서 익명 목록 조회를 막았던 원칙은 유지).

**`AdminDashboard.jsx` 변경**: `SECTIONS`에 항목 추가, `NO_CONTENT_KEYS`에도 포함 (기존 `analytics`, `account`와 동일 패턴).

```js
{ key: 'storage', label: '스토리지 사용량' }
```

**새 컴포넌트**: `src/components/admin/sections/StorageUsage.jsx`

- `supabase.storage.from('media').list('', { limit: 1000, sortBy: { column: 'name' } })`로 `media` 버킷의 전체 파일과 `metadata.size`를 가져온다. 파일이 1000개를 넘을 경우 `offset`을 늘려가며 반복 조회한다.
- 전체 사용량 합계를 MB/GB 단위로 계산하고, `STORAGE_LIMIT_GB = 1` (Free Plan 실측값) 상수 대비 사용률(%)을 표시한다. 상수 옆에 "요금제 변경 시 이 값을 수정하세요" 주석을 남긴다.
- 용량이 큰 파일 Top 10을 파일명 + 크기로 목록 표시한다.
- 로딩/에러 상태는 `VisitorAnalytics.jsx`와 동일한 패턴(로딩 텍스트, 에러 시 "다시 시도" 버튼)을 따른다.

## DB 마이그레이션

`supabase/update-storage-management.sql`

```sql
-- 관리자(authenticated)가 스토리지 사용량 조회를 위해 파일 목록을 볼 수 있도록 허용.
-- 기존 보안 강화 마이그레이션은 익명(anon) 목록 조회만 막았을 뿐이므로,
-- authenticated로 범위를 한정해 다시 추가해도 원래 취지에 어긋나지 않는다.
create policy "media authenticated list" on storage.objects
  for select to authenticated using (bucket_id = 'media');
```

## 에러 처리

- 업로드 413 에러(실제로 매우 큰 파일): 기존 안내 메시지 유지.
- `InvalidKey` 등 기타 에러: 기존 fallback 메시지(`업로드 실패: ${error.message}`) 유지 — 파일명 정규화로 이 케이스 자체가 사라지므로 별도 처리는 불필요.
- 스토리지 사용량 조회 실패: `VisitorAnalytics`와 동일하게 에러 메시지 + 다시 시도 버튼.

## 테스트 계획

프로젝트의 테스트 원칙(상호작용/로직이 있는 컴포넌트만 테스트, Supabase는 mock 처리)을 따른다.

- `ImageField.jsx`: 파일명에서 확장자를 추출해 안전한 경로를 만드는 로직을 테스트(한글 파일명, 공백 포함 파일명, 확장자 없는 파일, 대문자 확장자 등 케이스). 업로드 시 `supabase.storage` 관련 함수가 올바른 인자(정규화된 경로)로 호출되는지 mock으로 검증.
- `StorageUsage.jsx`: `list()` mock 응답을 기반으로 총 사용량 계산, 사용률(%) 계산, Top 10 정렬 로직을 테스트.
