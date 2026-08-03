import { render, screen, fireEvent } from '@testing-library/react'
import CharacterSectionBlock from '../CharacterSectionBlock'
import { useAuth } from '../../hooks/useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../../lib/analytics'
import { insertEvent } from '../../lib/tracking'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../../lib/analytics', () => ({
  canTrackVisit: vi.fn(),
  getOrCreateVisitorId: vi.fn(),
}))
vi.mock('../../lib/tracking', () => ({
  insertEvent: vi.fn(),
}))

const mockSection = {
  id: 'photo',
  heading: '대표 캐릭터 - 사진',
  categories: ['전체', '카테고리 1', '카테고리 2'],
  items: [
    { id: 1, title: '캐릭터 1', category: '카테고리 1', type: 'photo', src: '/p1.jpg', thumbnail: '/p1.jpg' },
    { id: 2, title: '캐릭터 2', category: '카테고리 1', type: 'photo', src: '/p2.jpg', thumbnail: '/p2.jpg' },
    { id: 3, title: '캐릭터 3', category: '카테고리 2', type: 'youtube', youtubeId: 'abc', thumbnail: '/p3.jpg' },
  ],
}

const manyItemsSection = {
  id: 'video',
  heading: '대표 캐릭터 - 영상',
  categories: ['전체', '카테고리 A', '카테고리 B'],
  items: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    title: `캐릭터 ${i + 1}`,
    category: i < 7 ? '카테고리 A' : '카테고리 B',
    type: 'photo',
    src: `/p${i + 1}.jpg`,
    thumbnail: `/p${i + 1}.jpg`,
  })),
}

describe('CharacterSectionBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ session: null, loading: false })
    canTrackVisit.mockReturnValue(false)
  })

  it('섹션 제목을 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.getByText('대표 캐릭터 - 사진')).toBeInTheDocument()
  })

  it('섹션 id를 앵커로 갖는다', () => {
    const { container } = render(<CharacterSectionBlock section={mockSection} />)
    expect(container.querySelector('#characters-photo')).toBeInTheDocument()
  })

  it('기본은 전체 캐릭터를 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('카테고리 1 필터 클릭 시 해당 카테고리만 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 1' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(2)
  })

  it('전체 필터 클릭 시 모든 캐릭터를 표시한다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 1' }))
    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('photo 타입 카드 클릭 시 PhotoModal이 열린다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])
    expect(screen.getAllByAltText('캐릭터 1')).toHaveLength(2)
  })

  it('youtube 타입 카드 클릭 시 모달에 영상 슬라이드가 열린다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[2])
    expect(screen.getByTitle('video-player')).toBeInTheDocument()
  })

  it('필터링된 카드가 6개 이하면 더보기 버튼이 없다', () => {
    render(<CharacterSectionBlock section={mockSection} />)
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
  })

  it('필터링된 카드가 7개 이상이면 처음엔 6개만 표시되고 더보기 버튼이 보인다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument()
  })

  it('더보기 클릭 시 나머지 카드가 모두 표시되고 버튼이 사라진다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    fireEvent.click(screen.getByRole('button', { name: '더보기' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
  })

  it('펼쳐진 상태에서 다른 카테고리로 필터를 바꾸면 다시 6개로 접힌 상태로 시작한다', () => {
    render(<CharacterSectionBlock section={manyItemsSection} />)
    fireEvent.click(screen.getByRole('button', { name: '더보기' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '카테고리 A' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument()
  })

  it('showMoreEnabled가 false면 6개를 넘어도 전부 표시되고 더보기 버튼이 없다', () => {
    const disabledSection = { ...manyItemsSection, showMoreEnabled: false }
    render(<CharacterSectionBlock section={disabledSection} />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument()
  })

  it('section에 heading을 data-track-label로 갖는다', () => {
    const { container } = render(<CharacterSectionBlock section={mockSection} />)
    expect(container.querySelector('#characters-photo')).toHaveAttribute('data-track-label', '대표 캐릭터 - 사진')
  })

  it('관리자가 아니면 카드 클릭 시 character_click 이벤트를 기록한다', () => {
    canTrackVisit.mockReturnValue(true)
    getOrCreateVisitorId.mockReturnValue('visitor-1')
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])

    expect(insertEvent).toHaveBeenCalledWith({
      eventType: 'character_click',
      label: '캐릭터 1',
      visitorId: 'visitor-1',
    })
  })

  it('관리자면 카드를 클릭해도 이벤트를 기록하지 않는다', () => {
    canTrackVisit.mockReturnValue(false)
    render(<CharacterSectionBlock section={mockSection} />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])

    expect(insertEvent).not.toHaveBeenCalled()
  })
})
