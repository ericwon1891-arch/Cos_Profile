# 이미지 업로드 에러 메시지 개선 설계

## 배경 / 문제

`src/components/admin/fields/ImageField.jsx`는 업로드 실패 시 이미 `alert()`로 팝업을 띄우고 있다. 다만 413(용량 초과) 케이스만 친절한 문구로 분기 처리되고, 그 외 모든 실패는 Supabase가 반환한 원본 기술 메시지(`error.message`)를 그대로 노출한다. 예를 들어 로그인 세션이 만료돼 RLS 정책 위반이 발생하면 `"new row violates row-level security policy"` 같은 문구가 그대로 뜨는데, 관리자 입장에서는 무엇이 잘못됐는지 알 수 없다.

## 목표

업로드 실패 원인을 몇 가지 흔한 케이스로 분류해, 각각 사람이 이해할 수 있는 한국어 안내 문구를 보여준다.

## 범위 밖

- 팝업 메커니즘 자체를 네이티브 `alert()`에서 커스텀 모달/토스트로 교체하는 것 — 이번 요청은 메시지 "내용" 개선이며, UI 방식 교체는 별도 요청 시 다룬다.
- 에러 로깅/모니터링 시스템 도입 — 대상 아님.

## 변경 대상

`src/components/admin/fields/ImageField.jsx`

## 설계

에러 분류 로직을 순수 함수 `classifyUploadError(error)`로 분리해 `handleFileChange`에서 분기 없이 호출하도록 단순화한다.

```js
function classifyUploadError(error) {
  if (error.statusCode === '413' || /exceeded|too large/i.test(error.message)) {
    return '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
  }
  if (/row-level security|not authorized|unauthorized/i.test(error.message)) {
    return '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
  }
  if (/network|failed to fetch/i.test(error.message)) {
    return '업로드 실패: 인터넷 연결을 확인해 주세요.'
  }
  return `업로드 실패: 문제가 계속되면 관리자에게 문의해 주세요. (${error.message})`
}
```

분류 기준(정규식은 대소문자 구분 없이 매칭):

| 케이스 | 판별 조건 | 안내 문구 |
|---|---|---|
| 용량 초과 | `statusCode === '413'` 또는 메시지에 `exceeded`/`too large` | 기존 문구 유지 |
| 로그인 만료/권한 없음 | 메시지에 `row-level security`, `not authorized`, `unauthorized` | 새로고침 후 재로그인 안내 |
| 네트워크 오류 | 메시지에 `network`, `failed to fetch` | 인터넷 연결 확인 안내 |
| 그 외 알 수 없는 에러 | 위 조건에 해당 없음 | 관리자 문의 안내 + 원본 기술 메시지를 괄호로 함께 표시 |

`handleFileChange`의 에러 처리 부분은 다음과 같이 단순화된다:

```js
if (error) {
  alert(classifyUploadError(error))
  return
}
```

## 테스트 계획

`classifyUploadError`는 로직이 있는 순수 함수이므로 프로젝트 테스트 원칙에 따라 단위 테스트를 작성한다. 4가지 분류(용량 초과/로그인 만료/네트워크 오류/그 외)에 대해 각각 올바른 문구를 반환하는지 검증하고, "그 외" 케이스에서는 원본 `error.message`가 결과 문자열에 포함되는지도 확인한다.
