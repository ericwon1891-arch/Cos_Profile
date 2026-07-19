import { renderHook, waitFor } from '@testing-library/react'
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
})
