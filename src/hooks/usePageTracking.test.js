import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { usePageTracking } from './usePageTracking'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabaseClient'
import * as analytics from '../lib/analytics'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))
vi.mock('../lib/analytics', () => ({
  getOrCreateVisitorId: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

describe('usePageTracking', () => {
  let insert

  beforeEach(() => {
    vi.clearAllMocks()
    insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })
    analytics.getOrCreateVisitorId.mockReturnValue('visitor-123')
  })

  it('로그인하지 않은 방문자가 공개 페이지에 접근하면 page_views에 기록한다', async () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('page_views'))
    expect(insert).toHaveBeenCalledWith({ path: '/', referrer: null, visitor_id: 'visitor-123' })
  })

  it('관리자 세션이 있으면 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('/admin 경로에서는 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/admin') })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('auth 로딩 중에는 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: null, loading: true })
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(supabase.from).not.toHaveBeenCalled()
  })
})
