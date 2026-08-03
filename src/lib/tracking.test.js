import { insertPageView, insertEvent } from './tracking'
import { supabase } from './supabaseClient'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('insertPageView', () => {
  it('page_views 테이블에 올바른 payload로 insert한다', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })

    await insertPageView({ path: '/', referrer: null, visitorId: 'v1' })

    expect(supabase.from).toHaveBeenCalledWith('page_views')
    expect(insert).toHaveBeenCalledWith({ path: '/', referrer: null, visitor_id: 'v1' })
  })

  it('insert 실패 시 콘솔에 에러를 남기고 예외를 던지지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insert = vi.fn().mockResolvedValue({ error: { message: '실패' } })
    supabase.from.mockReturnValue({ insert })

    await insertPageView({ path: '/', referrer: null, visitorId: 'v1' })

    expect(consoleSpy).toHaveBeenCalledWith('페이지뷰 기록 실패', { message: '실패' })
    consoleSpy.mockRestore()
  })
})

describe('insertEvent', () => {
  it('page_events 테이블에 올바른 payload로 insert한다', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ insert })

    await insertEvent({ eventType: 'section_view', label: 'Hero', visitorId: 'v1' })

    expect(supabase.from).toHaveBeenCalledWith('page_events')
    expect(insert).toHaveBeenCalledWith({ event_type: 'section_view', label: 'Hero', value: null, visitor_id: 'v1' })
  })

  it('insert 실패 시 콘솔에 에러를 남기고 예외를 던지지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const insert = vi.fn().mockResolvedValue({ error: { message: '실패' } })
    supabase.from.mockReturnValue({ insert })

    await insertEvent({ eventType: 'duration', value: 42, visitorId: 'v1' })

    expect(consoleSpy).toHaveBeenCalledWith('이벤트 기록 실패', { message: '실패' })
    consoleSpy.mockRestore()
  })
})
