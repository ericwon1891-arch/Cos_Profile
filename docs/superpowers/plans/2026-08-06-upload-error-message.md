# 이미지 업로드 에러 메시지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미지 업로드 실패 시 뜨는 `alert()` 팝업의 메시지를 원인별로 분류해 사람이 이해할 수 있는 한국어 문구로 바꾼다.

**Architecture:** 분류 로직을 순수 함수 `classifyUploadError(error)`로 `src/lib/uploadErrors.js`에 분리하고, `ImageField.jsx`는 이 함수의 반환값을 `alert()`에 그대로 넘기도록 단순화한다. 팝업 메커니즘(네이티브 `alert`)은 바꾸지 않는다.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react

**참고 설계 문서:** `docs/superpowers/specs/2026-08-06-upload-error-message-design.md`

## Global Constraints

- 모든 UI 텍스트와 주석은 한국어로 작성한다 (프로젝트 `CLAUDE.md`).
- 테스트는 상호작용/로직이 있는 함수·컴포넌트만 작성한다.
- 이번 작업은 로컬 코드/테스트 변경뿐이라(DB 마이그레이션 없음) 별도 확인 없이 진행 가능하다 (등급 **하**).

---

### Task 1: `classifyUploadError` 유틸 함수 추가 + `ImageField`에 연결

**Files:**
- Create: `src/lib/uploadErrors.js`
- Test: `src/lib/uploadErrors.test.js`
- Modify: `src/components/admin/fields/ImageField.jsx:1,10-19`
- Modify: `src/components/__tests__/ImageField.test.jsx`

**Interfaces:**
- Produces: `classifyUploadError(error: { statusCode?: string, message: string }): string` — 항상 `'업로드 실패: ...'` 형태의 완성된 한국어 안내 문자열을 반환한다.
- Consumes (in `ImageField.jsx`): `classifyUploadError`만 import해서 사용. 다른 시그니처 변경 없음.

**현재 코드** (`src/components/admin/fields/ImageField.jsx:10-19`):
```js
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      const isTooLarge = error.statusCode === '413' || /exceeded|too large/i.test(error.message)
      alert(
        isTooLarge
          ? '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
          : `업로드 실패: ${error.message}`
      )
      return
    }
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/uploadErrors.test.js`:
```js
import { classifyUploadError } from './uploadErrors'

describe('classifyUploadError', () => {
  it('413 상태코드면 용량 초과 안내를 반환한다', () => {
    expect(classifyUploadError({ statusCode: '413', message: 'Payload too large' })).toBe(
      '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
    )
  })

  it('메시지에 exceeded/too large가 있으면 용량 초과 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'file size exceeded limit' })).toBe(
      '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
    )
  })

  it('row-level security 관련 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(
      classifyUploadError({ message: 'new row violates row-level security policy' })
    ).toBe('업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.')
  })

  it('unauthorized 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'Unauthorized' })).toBe(
      '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
    )
  })

  it('네트워크 관련 메시지면 인터넷 연결 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'Failed to fetch' })).toBe(
      '업로드 실패: 인터넷 연결을 확인해 주세요.'
    )
  })

  it('분류되지 않는 에러는 관리자 문의 안내와 원본 메시지를 함께 반환한다', () => {
    expect(classifyUploadError({ message: '알 수 없는 서버 오류' })).toBe(
      '업로드 실패: 문제가 계속되면 관리자에게 문의해 주세요. (알 수 없는 서버 오류)'
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/uploadErrors.test.js`
Expected: FAIL — `Failed to resolve import "./uploadErrors"` (파일이 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/lib/uploadErrors.js`:
```js
export function classifyUploadError(error) {
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

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/uploadErrors.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: `ImageField.jsx`에 연결하는 실패하는 테스트 작성**

`src/components/__tests__/ImageField.test.jsx` 마지막 `it(...)` 뒤에 추가:
```jsx
  it('로그인 만료(RLS) 에러 시 재로그인 안내 alert를 띄운다', async () => {
    const upload = vi.fn().mockResolvedValue({
      error: { message: 'new row violates row-level security policy' },
    })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl: vi.fn() })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg')] } })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
      )
    )
    expect(onChange).not.toHaveBeenCalled()
  })
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `npm test -- src/components/__tests__/ImageField.test.jsx`
Expected: FAIL — 새 테스트에서 alert가 원본 메시지(`업로드 실패: new row violates row-level security policy`)로 호출되어 기대값과 불일치

- [ ] **Step 7: `ImageField.jsx` 수정**

`src/components/admin/fields/ImageField.jsx` 상단 import 추가:
```js
import { classifyUploadError } from '../../../lib/uploadErrors'
```

에러 처리 부분(현재 10-19줄)을 다음으로 교체:
```js
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      alert(classifyUploadError(error))
      return
    }
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- src/components/__tests__/ImageField.test.jsx`
Expected: PASS (3개 테스트 — 기존 2개 + 신규 1개)

- [ ] **Step 9: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 10: 커밋**

```bash
git add src/lib/uploadErrors.js src/lib/uploadErrors.test.js src/components/admin/fields/ImageField.jsx src/components/__tests__/ImageField.test.jsx
git commit -m "feat: 업로드 에러 메시지를 원인별로 분류해 안내 문구 개선"
```

---

## Self-Review 결과

- **스펙 커버리지**: 설계 문서의 4가지 분류(용량초과/로그인만료/네트워크/기타) 전부 Task 1 테스트에 반영됨.
- **플레이스홀더 스캔**: TBD/TODO 없음.
- **타입/시그니처 일관성**: `classifyUploadError(error)` 시그니처가 유틸 테스트와 컴포넌트 연결 코드에서 동일하게 사용됨.
