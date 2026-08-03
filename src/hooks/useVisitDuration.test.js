import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useVisitDuration } from './useVisitDuration'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisitDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateVisitorId.mockReturnValue('visitor-1')
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('탭이 hidden 상태가 되면 keepalive fetch로 체류 시간을 기록한다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/rest/v1/page_events')
    expect(options.keepalive).toBe(true)
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.event_type).toBe('duration')
    expect(body.visitor_id).toBe('visitor-1')
    expect(typeof body.value).toBe('number')
  })

  it('한 번 기록한 뒤 다시 hidden이 되어도 중복 전송하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')
    setVisibility('visible')
    setVisibility('hidden')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('canTrackVisit이 false이면 hidden이 되어도 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(false)
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('hidden')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('visibilityState가 hidden이 아니면 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useVisitDuration(), { wrapper: wrapper('/') })

    setVisibility('visible')

    expect(fetch).not.toHaveBeenCalled()
  })
})
