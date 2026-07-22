import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabaseClient'

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

describe('useAuth', () => {
  beforeEach(() => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('초기 세션이 없으면 isAuthenticated는 false다', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('세션이 있으면 isAuthenticated는 true다', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: '1' } } } })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('signIn 호출 시 supabase.auth.signInWithPassword를 호출한다', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signIn('a@b.com', 'pw')
    })

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })

  describe('changePassword', () => {
    beforeEach(() => {
      vi.clearAllMocks()
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
})
