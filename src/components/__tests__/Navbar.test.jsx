import { render, screen } from '@testing-library/react'
import Navbar from '../Navbar'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

describe('Navbar', () => {
  it('캐릭터 섹션이 여러 개면 섹션 제목마다 네비게이션 항목을 만든다', () => {
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
    render(<Navbar />)
    expect(screen.getByText('대표 캐릭터 - 사진')).toBeInTheDocument()
    expect(screen.getByText('대표 캐릭터 - 영상')).toBeInTheDocument()
  })

  it('로딩 중이면 캐릭터 섹션 네비게이션 항목을 표시하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.queryByText(/대표 캐릭터/)).not.toBeInTheDocument()
  })

  it('고정 항목(소개/경력/Contact)은 항상 표시된다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    render(<Navbar />)
    expect(screen.getByText('소개')).toBeInTheDocument()
    expect(screen.getByText('경력')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })
})
