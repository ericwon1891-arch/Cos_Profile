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

  it('영상 없이 사진만 있고 type 필드가 없어도 확대 아이콘을 표시한다', () => {
    const photoOnlyWork = {
      id: 5,
      title: '사진만 있는 캐릭터',
      category: '카테고리 1',
      photos: ['/photos/a.jpg'],
      thumbnail: '/photos/a.jpg',
    }
    render(<WorkCard work={photoOnlyWork} onClick={() => {}} />)
    expect(screen.getByTestId('photo-icon')).toBeInTheDocument()
  })

  it('사진+영상 혼합일 때도 재생 아이콘을 표시한다', () => {
    const mixedWork = {
      id: 3,
      title: '혼합',
      category: '카테고리 1',
      photos: ['/photos/a.jpg'],
      youtubeId: 'xyz',
      thumbnail: '/thumbnails/mixed.jpg',
    }
    render(<WorkCard work={mixedWork} onClick={() => {}} />)
    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
  })

  it('레거시 로컬 영상 타입일 때도 재생 아이콘을 표시한다', () => {
    const legacyLocalWork = {
      id: 4,
      title: '로컬 영상',
      category: '카테고리 1',
      type: 'local',
      src: '/videos/test.mp4',
      thumbnail: '/thumbnails/local.jpg',
    }
    render(<WorkCard work={legacyLocalWork} onClick={() => {}} />)
    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
  })
})
