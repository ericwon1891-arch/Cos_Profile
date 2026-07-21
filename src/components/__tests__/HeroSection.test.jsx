import { render } from '@testing-library/react'
import HeroSection from '../HeroSection'
import { useSectionContent } from '../../hooks/useSectionContent'

vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))

describe('HeroSection', () => {
  it('일반 비율에서는 object-cover를 유지하고, 극단적 비율(초광폭/세로로 긴 화면)에서 object-contain으로 전환되는 미디어쿼리 클래스를 포함한다', () => {
    useSectionContent.mockReturnValue({
      data: {
        photo: '/hero.jpg',
        label: '라벨',
        name: '이름',
        subtitle: '부제목',
        quote: '인용구',
        facts: [],
      },
      loading: false,
      error: null,
    })
    const { container } = render(<HeroSection />)
    const img = container.querySelector('img')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('[@media(min-aspect-ratio:3/2)]:object-contain')
    expect(img.className).toContain('[@media(max-aspect-ratio:3/4)]:object-contain')
  })

  it('로딩 중이면 이미지를 렌더링하지 않는다', () => {
    useSectionContent.mockReturnValue({ data: null, loading: true, error: null })
    const { container } = render(<HeroSection />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
