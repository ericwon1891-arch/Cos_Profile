# 관리자 비밀번호 변경 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 대시보드(`/admin`) 사이드바에 '계정 설정' 메뉴를 추가하고, 그 안에서 현재 비밀번호를 재확인한 뒤 새 비밀번호로 변경할 수 있는 폼을 제공한다. 모든 비밀번호 입력 필드는 기본적으로 가려져 있고, 눈 모양 버튼을 클릭하면 개별적으로 평문을 볼 수 있다.

**Architecture:** `useAuth` 훅에 `changePassword(currentPassword, newPassword)`를 추가해 `signInWithPassword`로 재인증 후 `updateUser`로 비밀번호를 바꾼다. 새 `AccountForm` 섹션 컴포넌트가 이 훅을 사용해 UI/검증/에러 표시를 담당하고, `AdminDashboard`의 사이드바 메뉴에서 기존 콘텐츠 섹션(`site_content` 기반)과 분리된 별도 렌더링 경로로 연결된다. 비밀번호 입력은 재사용 가능한 `PasswordField` 컴포넌트(토글형 표시/숨김)로 통일한다.

**Tech Stack:** React 19, Vite, Supabase JS v2 (`@supabase/supabase-js`), Tailwind CSS, Vitest + @testing-library/react.

## Global Constraints

- 새로운 npm 의존성을 추가하지 않는다 (아이콘은 인라인 SVG로 직접 작성).
- 모든 사용자 노출 문자열은 한국어로 작성한다 (CLAUDE.md 언어 규칙).
- 새 비밀번호는 6자 이상이어야 한다 (Supabase Auth 기본 최소 길이 정책).
- 비밀번호 변경은 관리자 대시보드(`/admin`, `RequireAuth`로 보호됨) 내부에서만 접근 가능해야 하며 공개 사이트/로그인 화면에는 영향을 주지 않는다.
- 기존 테스트 컨벤션을 따른다: 훅 테스트는 훅 파일과 같은 디렉터리에 `*.test.js`로, 컴포넌트 테스트는 `src/components/__tests__/*.test.jsx`에 둔다. 컴포넌트 테스트는 `useAuth`/`useSectionContent`를 `vi.mock`으로 모킹하고, 훅 테스트는 `../lib/supabaseClient`를 모킹한다.

---

### Task 1: PasswordField 컴포넌트 (표시/숨김 토글)

**Files:**
- Create: `src/components/admin/fields/PasswordField.jsx`
- Test: `src/components/__tests__/PasswordField.test.jsx`

**Interfaces:**
- Produces: `PasswordField({ label, value, onChange })` — `TextField`와 동일한 props 시그니처의 기본 export. `onChange`는 `(newValue: string) => void`. 내부적으로 `useId()`로 생성한 id를 `<label htmlFor>` / `<input id>`에 연결해 `getByLabelText(label)`이 input 하나만 가리키도록 한다 (버튼은 label 안에 넣지 않는다). 토글 버튼의 `aria-label`은 `${label} 표시` / `${label} 숨기기`.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/PasswordField.test.jsx` 생성:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import PasswordField from '../admin/fields/PasswordField'

describe('PasswordField', () => {
  it('기본 상태는 비밀번호가 가려져 있다', () => {
    render(<PasswordField label="새 비밀번호" value="secret" onChange={() => {}} />)
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'password')
  })

  it('토글 버튼을 클릭하면 비밀번호가 보이고, 다시 클릭하면 숨겨진다', () => {
    render(<PasswordField label="새 비밀번호" value="secret" onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 표시' }))
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 숨기기' }))
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'password')
  })

  it('입력 변경 시 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<PasswordField label="새 비밀번호" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abc123' } })
    expect(onChange).toHaveBeenCalledWith('abc123')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- PasswordField`
Expected: FAIL — `Cannot find module '../admin/fields/PasswordField'` (파일이 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/fields/PasswordField.jsx` 생성:

```jsx
import { useId, useState } from 'react'

export default function PasswordField({ label, value, onChange }) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? `${label} 숨기기` : `${label} 표시`}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.243L9.88 9.88" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- PasswordField`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/fields/PasswordField.jsx src/components/__tests__/PasswordField.test.jsx
git commit -m "feat: 표시/숨김 토글이 가능한 PasswordField 컴포넌트 추가"
```

---

### Task 2: useAuth에 changePassword 추가

**Files:**
- Modify: `src/hooks/useAuth.js`
- Test: `src/hooks/useAuth.test.js`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `supabase.auth.updateUser` (기존 mock에 `updateUser` 추가 필요), `session.user.email` (훅 내부 state).
- Produces: `changePassword(currentPassword: string, newPassword: string) => Promise<{ error: null | { step: 'reauth' | 'update', message: string } }>`. `useAuth()`가 반환하는 객체에 `changePassword` 필드로 노출된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/hooks/useAuth.test.js`를 다음과 같이 수정한다. 먼저 mock에 `updateUser`를 추가:

```js
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))
```

파일 맨 아래(기존 마지막 `it` 블록 다음, `describe` 블록 닫는 줄 앞)에 새 `describe` 블록을 추가:

```js
  describe('changePassword', () => {
    beforeEach(() => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: '1', email: 'admin@test.com' } } },
      })
    })

    it('현재 비밀번호 재확인과 새 비밀번호 변경에 성공하면 error는 null이다', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))

      let response
      await act(async () => {
        response = await result.current.changePassword('old-pw', 'new-pw')
      })

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'admin@test.com', password: 'old-pw' })
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-pw' })
      expect(response.error).toBeNull()
    })

    it('현재 비밀번호가 틀리면 reauth 에러를 반환하고 updateUser는 호출하지 않는다', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))

      let response
      await act(async () => {
        response = await result.current.changePassword('wrong-pw', 'new-pw')
      })

      expect(response.error).toEqual({ step: 'reauth', message: 'Invalid login credentials' })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('재인증은 성공했지만 updateUser가 실패하면 update 에러를 반환한다', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password too weak' } })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))

      let response
      await act(async () => {
        response = await result.current.changePassword('old-pw', 'new-pw')
      })

      expect(response.error).toEqual({ step: 'update', message: 'Password too weak' })
    })
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- useAuth`
Expected: FAIL — `result.current.changePassword is not a function`

- [ ] **Step 3: 최소 구현 작성**

`src/hooks/useAuth.js`의 `signOut` 함수 다음(28번째 줄 근처, `return { session, ... }` 이전)에 추가:

```js
  async function changePassword(currentPassword, newPassword) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })
    if (reauthError) {
      return { error: { step: 'reauth', message: reauthError.message } }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      return { error: { step: 'update', message: updateError.message } }
    }

    return { error: null }
  }
```

그리고 반환문을 다음과 같이 수정한다:

```js
  return { session, loading, isAuthenticated: !!session, signIn, signOut, changePassword }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- useAuth`
Expected: PASS (기존 3개 + 신규 3개, 총 6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useAuth.js src/hooks/useAuth.test.js
git commit -m "feat: useAuth에 changePassword 추가 (현재 비밀번호 재인증 후 변경)"
```

---

### Task 3: AccountForm 컴포넌트

**Files:**
- Create: `src/components/admin/sections/AccountForm.jsx`
- Test: `src/components/__tests__/AccountForm.test.jsx`

**Interfaces:**
- Consumes: `PasswordField` (Task 1의 `{ label, value, onChange }` props), `useAuth().changePassword` (Task 2의 `(currentPassword, newPassword) => Promise<{ error }>`).
- Produces: `AccountForm()` — props 없는 기본 export. `AdminDashboard`가 `activeKey === 'account'`일 때 렌더링한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/AccountForm.test.jsx` 생성:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import AccountForm from '../admin/sections/AccountForm'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

function fillForm({ current = 'old-pw', next = 'new-pw123', confirm = 'new-pw123' } = {}) {
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: confirm } })
}

describe('AccountForm', () => {
  it('새 비밀번호가 6자 미만이면 검증 에러를 표시하고 changePassword를 호출하지 않는다', () => {
    const changePassword = vi.fn()
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm({ next: '123', confirm: '123' })
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(screen.getByText('비밀번호는 6자 이상이어야 합니다.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('새 비밀번호와 확인값이 다르면 검증 에러를 표시한다', () => {
    const changePassword = vi.fn()
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm({ next: 'new-pw123', confirm: 'different' })
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(screen.getByText('새 비밀번호가 일치하지 않습니다.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('제출 성공 시 성공 메시지를 표시하고 필드를 초기화한다', async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: null })
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(await screen.findByText('비밀번호가 변경되었습니다.')).toBeInTheDocument()
    expect(changePassword).toHaveBeenCalledWith('old-pw', 'new-pw123')
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue('')
  })

  it('현재 비밀번호가 틀리면 에러 메시지를 표시하고 필드를 유지한다', async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: { step: 'reauth', message: 'Invalid login credentials' } })
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(await screen.findByText('현재 비밀번호가 올바르지 않습니다.')).toBeInTheDocument()
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('new-pw123')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- AccountForm`
Expected: FAIL — `Cannot find module '../admin/sections/AccountForm'`

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/sections/AccountForm.jsx` 생성:

```jsx
import { useState } from 'react'
import PasswordField from '../fields/PasswordField'
import { useAuth } from '../../../hooks/useAuth'

export default function AccountForm() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: '비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: '새 비밀번호가 일치하지 않습니다.' })
      return
    }

    setStatus({ type: 'pending', message: '변경 중...' })
    const { error } = await changePassword(currentPassword, newPassword)

    if (error?.step === 'reauth') {
      setStatus({ type: 'error', message: '현재 비밀번호가 올바르지 않습니다.' })
      return
    }
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({ type: 'success', message: '비밀번호가 변경되었습니다.' })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <PasswordField label="현재 비밀번호" value={currentPassword} onChange={setCurrentPassword} />
      <PasswordField label="새 비밀번호" value={newPassword} onChange={setNewPassword} />
      <PasswordField label="새 비밀번호 확인" value={confirmPassword} onChange={setConfirmPassword} />
      {status && (
        <p
          className={`text-sm mb-4 ${
            status.type === 'error' ? 'text-red-500' : status.type === 'success' ? 'text-green-600' : 'text-gray-500'
          }`}
        >
          {status.message}
        </p>
      )}
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">
        변경
      </button>
    </form>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- AccountForm`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/sections/AccountForm.jsx src/components/__tests__/AccountForm.test.jsx
git commit -m "feat: 비밀번호 변경 AccountForm 컴포넌트 추가"
```

---

### Task 4: AdminDashboard에 '계정 설정' 메뉴 연결

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`
- Test: `src/components/__tests__/AdminDashboard.test.jsx`

**Interfaces:**
- Consumes: `AccountForm` (Task 3, props 없음).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/__tests__/AdminDashboard.test.jsx` 마지막 `it` 블록 뒤, `describe` 닫는 줄 앞에 추가:

```js
  it('계정 설정 메뉴를 클릭하면 비밀번호 변경 폼을 보여준다', () => {
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: '계정 설정' }))

    expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- AdminDashboard`
Expected: FAIL — `계정 설정` 버튼을 찾을 수 없음 (`Unable to find role="button" and name "계정 설정"`)

- [ ] **Step 3: 최소 구현 작성**

`src/components/admin/AdminDashboard.jsx` 상단 import 목록(14번째 줄, `RequireAuth` import 위 또는 아래)에 추가:

```js
import AccountForm from './sections/AccountForm'
```

`SECTIONS` 배열(16-27번째 줄) 마지막 항목 뒤에 추가:

```js
const SECTIONS = [
  { key: 'hero', label: 'Hero', Form: HeroForm },
  { key: 'about', label: 'About Me', Form: AboutForm },
  { key: 'strength', label: 'Strength', Form: StrengthForm },
  { key: 'career', label: 'Career', Form: CareerForm },
  { key: 'characters', label: '대표 캐릭터', Form: CharactersForm },
  { key: 'available', label: 'Available', Form: AvailableForm },
  { key: 'sns', label: 'SNS', Form: SnsForm },
  { key: 'services', label: 'Additional Services', Form: ServicesForm },
  { key: 'personality', label: 'Personality', Form: PersonalityForm },
  { key: 'contact', label: 'Contact', Form: ContactForm },
  { key: 'account', label: '계정 설정' },
]
```

`<main>` 블록(82-89번째 줄)을 다음으로 교체:

```jsx
        <main className="flex-1 p-8 max-w-2xl">
          {activeKey === 'account' && <AccountForm />}
          {activeKey !== 'account' && !loading && data && active && (
            <active.Form data={data} onSave={handleSave} />
          )}
          {activeKey !== 'account' && !loading && !data && (
            <p className="text-gray-500 text-sm">이 섹션의 데이터가 없습니다. supabase/seed.sql을 실행했는지 확인해 주세요.</p>
          )}
        </main>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- AdminDashboard`
Expected: PASS (기존 2개 + 신규 1개, 총 3 tests)

- [ ] **Step 5: 전체 테스트 스위트 확인**

Run: `npm test`
Expected: PASS — 모든 테스트(useAuth, AdminLogin, RequireAuth, AdminDashboard, AccountForm, PasswordField 등) 통과

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminDashboard.jsx src/components/__tests__/AdminDashboard.test.jsx
git commit -m "feat: 관리자 사이드바에 계정 설정(비밀번호 변경) 메뉴 연결"
```

---

## 수동 확인 (선택)

자동화 테스트 외에, 실제 Supabase 프로젝트에 연결된 환경에서 `npm run dev` 후 다음을 브라우저로 확인하는 것을 권장한다:

1. `/admin/login`으로 로그인
2. 사이드바에서 '계정 설정' 클릭 → 비밀번호 변경 폼 노출 확인
3. 눈 모양 아이콘 클릭 → 입력한 텍스트가 평문으로 보이는지 확인
4. 틀린 현재 비밀번호로 제출 → "현재 비밀번호가 올바르지 않습니다." 표시 확인
5. 올바른 현재 비밀번호 + 새 비밀번호(6자 이상, 확인값 일치)로 제출 → 성공 메시지 확인, 로그아웃 후 새 비밀번호로 재로그인 확인
