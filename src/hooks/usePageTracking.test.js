import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { usePageTracking } from './usePageTracking'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertPageView } from '../lib/tracking'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))
vi.mock('../lib/tracking', () => ({
  insertPageView: vi.fn(),
}))

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

describe('usePageTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateVisitorId.mockReturnValue('visitor-123')
  })

  it('canTrackVisit이 true이면 page_views를 기록한다', async () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    canTrackVisit.mockReturnValue(true)
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    await waitFor(() => expect(insertPageView).toHaveBeenCalledWith({
      path: '/',
      referrer: null,
      visitorId: 'visitor-123',
    }))
    expect(canTrackVisit).toHaveBeenCalledWith({ pathname: '/', session: null, loading: false })
  })

  it('canTrackVisit이 false이면 기록하지 않는다', () => {
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
    canTrackVisit.mockReturnValue(false)
    renderHook(() => usePageTracking(), { wrapper: wrapper('/') })

    expect(insertPageView).not.toHaveBeenCalled()
  })
})
