import { render, screen, fireEvent } from '@testing-library/react'
import WorkCard from '../WorkCard'

const work = {
  id: 1,
  title: '테스트 작업물',
  category: '유튜브/SNS',
  type: 'youtube',
  youtubeId: 'abc123',
  thumbnail: '/thumbnails/test.jpg',
}

describe('WorkCard', () => {
  it('작업물 제목을 렌더링한다', () => {
    render(<WorkCard work={work} onClick={() => {}} />)
    expect(screen.getByText('테스트 작업물')).toBeInTheDocument()
  })

  it('카테고리를 렌더링한다', () => {
    render(<WorkCard work={work} onClick={() => {}} />)
    expect(screen.getByText('유튜브/SNS')).toBeInTheDocument()
  })

  it('클릭 시 onClick에 work 객체를 전달한다', () => {
    const onClick = vi.fn()
    render(<WorkCard work={work} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('work-card'))
    expect(onClick).toHaveBeenCalledWith(work)
  })
})
