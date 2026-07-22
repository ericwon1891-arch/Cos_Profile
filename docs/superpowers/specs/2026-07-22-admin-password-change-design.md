# 관리자 비밀번호 변경 기능 — 설계

## 배경 / 목적

`portfolio-cosplay`는 소유자 1인이 사용하는 Supabase Auth 기반 관리자 대시보드(`/admin`)를 갖고 있다. 현재 로그인(`AdminLogin.jsx`)과 로그아웃만 존재하고, 로그인된 상태에서 비밀번호를 변경할 방법이 프론트엔드에 없다. 이 기능을 관리자 메뉴 내부에 추가한다.

## 범위

- 관리자 대시보드(`/admin`) 내부에서만 접근 가능한 비밀번호 변경 UI/로직 추가
- 공개 사이트(`/`)나 로그인 화면(`/admin/login`)에는 영향 없음
- 다중 사용자/역할 개념 없음 (단일 관리자 계정 전제)

## 배치 & 아키텍처

- `AdminDashboard.jsx`의 `SECTIONS` 배열 맨 끝에 `{ key: 'account', label: '계정 설정' }` 항목 추가 → 사이드바 메뉴로 노출.
- 기존 섹션들은 `useSectionContent(activeKey)`로 `site_content` 테이블 데이터를 읽고 `Form(data, onSave)` 패턴으로 `site_content`에 저장한다. 비밀번호 변경은 콘텐츠 데이터가 아니라 Supabase Auth 자체를 다루므로 이 패턴을 따르지 않는다.
- `AdminDashboard.jsx`의 렌더링 분기에서 `activeKey === 'account'`일 때는 `useSectionContent` 결과를 사용하지 않고 `<AccountForm />`을 독립적으로 렌더링한다.

```
{activeKey === 'account' ? (
  <AccountForm />
) : (
  !loading && data && active && <active.Form data={data} onSave={handleSave} />
)}
```

## 인증 플로우 (`src/hooks/useAuth.js`)

`changePassword(currentPassword, newPassword)` 함수를 추가한다.

1. 현재 세션의 `session.user.email`로 `supabase.auth.signInWithPassword({ email, password: currentPassword })`를 호출해 현재 비밀번호가 맞는지 재확인한다.
2. 재확인 실패 시 `{ error: { step: 'reauth', message: ... } }` 형태로 반환.
3. 재확인 성공 시 `supabase.auth.updateUser({ password: newPassword })` 호출.
4. 업데이트 실패 시 `{ error: { step: 'update', message: ... } }` 반환, 성공 시 `{ error: null }` 반환.

세션이 없는 상태(비로그인)에서 호출되는 경우는 없다고 가정한다 (`RequireAuth`로 이미 보호됨).

## UI 컴포넌트

### `src/components/admin/fields/PasswordField.jsx` (신규)

- `TextField`와 동일한 `label`, `value`, `onChange` props를 받는다.
- 내부 `showPassword` state로 `<input type="password">` ↔ `<input type="text">` 를 토글한다.
- input 오른쪽에 눈 모양 토글 버튼(인라인 SVG, 아이콘 라이브러리 추가 없음) 배치. 버튼은 `type="button"`으로 폼 제출을 트리거하지 않도록 한다.
- 각 `PasswordField` 인스턴스는 자신의 `showPassword` state를 독립적으로 가지므로 여러 필드 중 하나만 열어도 나머지는 계속 숨김 상태를 유지한다.

### `src/components/admin/sections/AccountForm.jsx` (신규)

- 필드 3개, 모두 `PasswordField` 사용: 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인.
- 제출 시 클라이언트 검증 순서:
  1. 새 비밀번호 6자 미만 → "비밀번호는 6자 이상이어야 합니다."
  2. 새 비밀번호 ≠ 확인값 → "새 비밀번호가 일치하지 않습니다."
  3. 통과 시 `useAuth().changePassword(currentPassword, newPassword)` 호출.
- 결과 메시지는 폼 내부에 자체 상태(`status`)로 표시한다 (`AdminLogin.jsx`의 인라인 에러 패턴과 동일한 스타일, `AdminDashboard`의 전역 토스트와는 별개).
  - `step: 'reauth'` 에러 → "현재 비밀번호가 올바르지 않습니다."
  - `step: 'update'` 에러 → Supabase 원문 메시지 노출.
  - 성공 → "비밀번호가 변경되었습니다." 표시 후 3개 입력 필드 초기화.

## 에러 처리 요약

| 상황 | 메시지 |
|---|---|
| 새 비밀번호 6자 미만 | 비밀번호는 6자 이상이어야 합니다. |
| 새 비밀번호/확인 불일치 | 새 비밀번호가 일치하지 않습니다. |
| 현재 비밀번호 불일치 | 현재 비밀번호가 올바르지 않습니다. |
| Supabase updateUser 실패 | Supabase 에러 메시지 원문 |
| 성공 | 비밀번호가 변경되었습니다. |

## 테스트 계획

- `src/hooks/useAuth.test.js`: `changePassword` 케이스 추가
  - 재인증 성공 + updateUser 성공 → `error: null`
  - 재인증 실패 → `step: 'reauth'` 에러, `updateUser` 미호출 검증
  - 재인증 성공 + updateUser 실패 → `step: 'update'` 에러
- `src/components/admin/sections/AccountForm.test.jsx` (신규)
  - 새 비밀번호 6자 미만 → 검증 에러 표시, `changePassword` 미호출
  - 확인 불일치 → 검증 에러 표시
  - 정상 제출 성공 → 성공 메시지 + 필드 초기화
  - 정상 제출 실패(현재 비밀번호 오류) → 에러 메시지 표시, 필드 유지
- `src/components/admin/fields/PasswordField.test.jsx` (신규, 필요시 기존 필드 테스트 패턴 참고)
  - 기본 상태 `type="password"`
  - 토글 버튼 클릭 시 `type="text"`로 전환, 다시 클릭 시 원복

## 영향받는 기존 파일

- `src/components/admin/AdminDashboard.jsx`: `SECTIONS`에 `account` 추가, 렌더 분기 수정
- `src/hooks/useAuth.js`: `changePassword` 추가
