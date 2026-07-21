import { render, screen, fireEvent } from '@testing-library/react'
import CharacterSectionBlock from '../CharacterSectionBlock'

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

describe('CharacterSectionBlock', () => {
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
})
