import { renderHook, waitFor, act } from '@testing-library/react'
import { useSectionContent } from './useSectionContent'
import { supabase } from '../lib/supabaseClient'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('useSectionContent', () => {
  it('로딩 후 섹션 데이터를 반환한다', async () => {
    const single = vi.fn().mockResolvedValue({ data: { data: { heading: 'ABOUT ME' } }, error: null })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useSectionContent('about'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(supabase.from).toHaveBeenCalledWith('site_content')
    expect(select).toHaveBeenCalledWith('data')
    expect(eq).toHaveBeenCalledWith('section', 'about')
    expect(result.current.data).toEqual({ heading: 'ABOUT ME' })
    expect(result.current.error).toBeNull()
  })

  it('에러 발생 시 error를 반환하고 data는 null이다', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: '실패' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useSectionContent('hero'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toEqual({ message: '실패' })
    expect(result.current.data).toBeNull()
  })

  it('네트워크 실패로 promise reject 시 loading을 false로 하고 error를 설정한다', async () => {
    const networkError = new Error('network error')
    const single = vi.fn().mockRejectedValue(networkError)
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useSectionContent('contact'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toEqual(networkError)
    expect(result.current.data).toBeNull()
  })

  it('section이 바뀌면 새 데이터가 도착하기 전까지 이전 섹션의 data를 반환하지 않는다', async () => {
    let resolveAbout
    let resolveStrength

    const makeSingle = (promise) => vi.fn().mockReturnValue(promise)
    const eqAbout = vi.fn().mockReturnValue({ single: makeSingle(new Promise(r => { resolveAbout = r })) })
    const eqStrength = vi.fn().mockReturnValue({ single: makeSingle(new Promise(r => { resolveStrength = r })) })
    const select = vi.fn()
      .mockReturnValueOnce({ eq: eqAbout })
      .mockReturnValueOnce({ eq: eqStrength })
    supabase.from.mockReturnValue({ select })

    const { result, rerender } = renderHook(
      ({ section }) => useSectionContent(section),
      { initialProps: { section: 'about' } }
    )

    await act(async () => {
      resolveAbout({ data: { data: { heading: 'ABOUT ME', body: '...' } }, error: null })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ heading: 'ABOUT ME', body: '...' })

    rerender({ section: 'strength' })

    // Before the 'strength' fetch resolves, the hook must not hand back
    // 'about'-shaped data under the 'strength' key — that mismatch is what
    // crashed AdminDashboard's ListField-based forms in production.
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()

    await act(async () => {
      resolveStrength({ data: { data: { heading: 'STRENGTH', items: [] } }, error: null })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ heading: 'STRENGTH', items: [] })
  })

  it('section이 없으면(falsy) fetch를 하지 않고 즉시 loading false, data null을 반환한다', () => {
    const callsBefore = supabase.from.mock.calls.length

    const { result } = renderHook(() => useSectionContent(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(supabase.from.mock.calls.length).toBe(callsBefore)
  })
})
