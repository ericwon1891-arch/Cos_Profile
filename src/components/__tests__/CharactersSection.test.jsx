import { render, screen } from '@testing-library/react'
import CharactersSection from '../CharactersSection'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

vi.mock('../CharacterSectionBlock', () => ({
  default: ({ section }) => <div data-testid="section-block">{section.heading}</div>,
}))

describe('CharactersSection', () => {
  it('섹션 배열 순서대로 CharacterSectionBlock을 렌더링한다', () => {
    useSectionContent.mockReturnValue({
      data: {
        sections: [
          { id: 'photo', heading: '대표 캐릭터 - 사진', categories: [], items: [] },
          { id: 'video', heading: '대표 캐릭터 - 영상', categories: [], items: [] },
        ],
      },
      loading: false,
      error: null,
    })
    render(<CharactersSection />)
    const blocks = screen.getAllByTestId('section-block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toHaveTextContent('대표 캐릭터 - 사진')
    expect(blocks[1]).toHaveTextContent('대표 캐릭터 - 영상')
  })

  it('섹션이 빈 배열이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: { sections: [] }, loading: false, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })

  it('로딩 중이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })

  it('data가 null이면 아무것도 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: false, error: null })
    render(<CharactersSection />)
    expect(screen.queryAllByTestId('section-block')).toHaveLength(0)
  })
})
