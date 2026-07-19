import { render, screen, fireEvent } from '@testing-library/react'
import WorkCard from '../WorkCard'

const videoWork = {
  id: 1,
  title: '테스트 작업물',
  category: '카테고리 1',
  type: 'youtube',
  youtubeId: 'abc123',
  thumbnail: '/thumbnails/test.jpg',
}

const photoWork = {
  id: 2,
  title: '테스트 사진',
  category: '카테고리 1',
  type: 'photo',
  src: '/photos/test.jpg',
  thumbnail: '/photos/test.jpg',
}

describe('WorkCard', () => {
  it('작업물 제목을 렌더링한다', () => {
    render(<WorkCard work={videoWork} onClick={() => {}} />)
    expect(screen.getByText('테스트 작업물')).toBeInTheDocument()
  })

  it('카테고리를 렌더링한다', () => {
    render(<WorkCard work={videoWork} onClick={() => {}} />)
    expect(screen.getByText('카테고리 1')).toBeInTheDocument()
  })

  it('클릭 시 onClick에 work 객체를 전달한다', () => {
    const onClick = vi.fn()
    render(<WorkCard work={videoWork} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('work-card'))
    expect(onClick).toHaveBeenCalledWith(videoWork)
  })

  it('video 타입일 때 재생 아이콘을 표시한다', () => {
    render(<WorkCard work={videoWork} onClick={() => {}} />)
    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
  })

  it('photo 타입일 때 확대 아이콘을 표시한다', () => {
    render(<WorkCard work={photoWork} onClick={() => {}} />)
    expect(screen.getByTestId('photo-icon')).toBeInTheDocument()
  })
})
