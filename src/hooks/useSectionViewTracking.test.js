import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useSectionViewTracking } from './useSectionViewTracking'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertEvent } from '../lib/tracking'

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))
vi.mock('../lib/tracking', () => ({
  insertEvent: vi.fn(),
}))

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    this.unobserve = vi.fn()
    MockIntersectionObserver.instances.push(this)
  }
}
MockIntersectionObserver.instances = []

function wrapper(initialPath) {
  return function Wrapper({ children }) {
    return createElement(MemoryRouter, { initialEntries: [initialPath] }, children)
  }
}

describe('useSectionViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    global.IntersectionObserver = MockIntersectionObserver
    getOrCreateVisitorId.mockReturnValue('visitor-1')
    document.body.innerHTML = ''
  })

  it('canTrackVisit이 true이면 화면에 보이는 섹션을 라벨로 기록한다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: true, target: section }])

    expect(insertEvent).toHaveBeenCalledWith({
      eventType: 'section_view',
      label: 'Hero',
      visitorId: 'visitor-1',
    })
  })

  it('같은 섹션이 다시 교차해도 중복 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: true, target: section }])
    instance.callback([{ isIntersecting: true, target: section }])

    expect(insertEvent).toHaveBeenCalledTimes(1)
  })

  it('isIntersecting이 false인 엔트리는 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    const section = document.createElement('section')
    section.dataset.trackLabel = 'Hero'
    document.body.appendChild(section)

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const instance = MockIntersectionObserver.instances[0]
    instance.callback([{ isIntersecting: false, target: section }])

    expect(insertEvent).not.toHaveBeenCalled()
  })

  it('canTrackVisit이 false이면 IntersectionObserver를 만들지 않는다', () => {
    canTrackVisit.mockReturnValue(false)
    useAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })

    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it('MutationObserver로 나중에 추가된 섹션도 관찰 대상에 포함한다', async () => {
    canTrackVisit.mockReturnValue(true)
    useAuth.mockReturnValue({ session: null, loading: false })
    renderHook(() => useSectionViewTracking(), { wrapper: wrapper('/') })

    const section = document.createElement('section')
    section.dataset.trackLabel = 'Characters'
    document.body.appendChild(section)

    await waitFor(() => {
      const instance = MockIntersectionObserver.instances[0]
      expect(instance.observe).toHaveBeenCalledWith(section)
    })
  })
})
