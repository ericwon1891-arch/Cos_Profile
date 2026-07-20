import { render, screen, fireEvent } from '@testing-library/react'
import PhotoModal from '../PhotoModal'

const photoWork = {
  id: 1,
  title: '테스트 사진',
  type: 'photo',
  src: '/photos/test.jpg',
}

const galleryWork = {
  id: 2,
  title: '갤러리 캐릭터',
  type: 'photo',
  src: '/photos/cover.jpg',
  photos: ['/photos/a.jpg', '/photos/b.jpg', '/photos/c.jpg'],
}

const legacyYoutubeWork = {
  id: 3,
  title: '레거시 유튜브',
  type: 'youtube',
  youtubeId: 'abc123',
}

const legacyLocalVideoWork = {
  id: 4,
  title: '레거시 로컬 영상',
  type: 'local',
  src: '/videos/test.mp4',
}

const mixedYoutubeWork = {
  id: 5,
  title: '혼합 캐릭터',
  photos: ['/photos/a.jpg', '/photos/b.jpg'],
  youtubeId: 'xyz789',
  youtubeStart: 93,
}

const mixedLocalVideoWork = {
  id: 6,
  title: '혼합 로컬 영상',
  photos: ['/photos/a.jpg'],
  localVideoSrc: '/videos/mixed.mp4',
}

describe('PhotoModal', () => {
  it('사진을 렌더링한다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    const img = screen.getByAltText('테스트 사진')
    expect(img).toHaveAttribute('src', '/photos/test.jpg')
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<PhotoModal work={photoWork} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /닫기/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<PhotoModal work={photoWork} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('슬라이드가 1개면 화살표/카운터를 표시하지 않는다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이전')).not.toBeInTheDocument()
  })

  it('사진이 여러 장이면 첫 사진과 카운터를 표시한다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/a.jpg')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('다음 버튼 클릭 시 다음 슬라이드로 넘어간다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/b.jpg')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('첫 슬라이드에서 이전 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByLabelText('이전')).toBeDisabled()
  })

  it('마지막 슬라이드에서 다음 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByLabelText('다음')).toBeDisabled()
  })

  it('photos가 빈 문자열 슬롯만 있으면 대표 사진으로 대체된다', () => {
    const work = { ...photoWork, photos: [''] }
    render(<PhotoModal work={work} onClose={() => {}} />)
    expect(screen.getByAltText('테스트 사진')).toHaveAttribute('src', '/photos/test.jpg')
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
  })

  it('photos에 빈 문자열 슬롯이 섞여 있으면 걸러내고 유효한 사진만 표시한다', () => {
    const work = { ...galleryWork, photos: ['/photos/a.jpg', '', '/photos/b.jpg'] }
    render(<PhotoModal work={work} onClose={() => {}} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('레거시 유튜브 전용 캐릭터는 영상 슬라이드 하나만 표시한다', () => {
    render(<PhotoModal work={legacyYoutubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
    expect(screen.queryByLabelText('다음')).not.toBeInTheDocument()
  })

  it('레거시 로컬 영상 전용 캐릭터는 video 엘리먼트를 표시한다', () => {
    render(<PhotoModal work={legacyLocalVideoWork} onClose={() => {}} />)
    const video = screen.getByTestId('local-video')
    expect(video).toHaveAttribute('src', '/videos/test.mp4')
  })

  it('사진+유튜브 혼합이면 사진들 다음 마지막에 영상 슬라이드가 온다', () => {
    render(<PhotoModal work={mixedYoutubeWork} onClose={() => {}} />)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/xyz789'))
    expect(screen.getByLabelText('다음')).toBeDisabled()
  })

  it('youtubeStart가 있으면 embed URL에 start 파라미터를 붙인다', () => {
    render(<PhotoModal work={mixedYoutubeWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('start=93'))
  })

  it('youtubeStart가 없으면 embed URL에 start 파라미터가 없다', () => {
    render(<PhotoModal work={legacyYoutubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe.getAttribute('src')).not.toContain('start=')
  })

  it('사진+로컬 영상 혼합이면 마지막 슬라이드에 video 엘리먼트를 표시한다', () => {
    render(<PhotoModal work={mixedLocalVideoWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음'))
    const video = screen.getByTestId('local-video')
    expect(video).toHaveAttribute('src', '/videos/mixed.mp4')
  })

  it('youtubeId에 youtu.be 단축 링크가 들어있어도 영상 ID만 추출해 재생한다', () => {
    const work = { ...legacyYoutubeWork, youtubeId: 'https://youtu.be/abc123?t=5' }
    render(<PhotoModal work={work} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
  })

  it('youtubeId에 watch?v= 링크가 들어있어도 영상 ID만 추출해 재생한다', () => {
    const work = { ...legacyYoutubeWork, youtubeId: 'https://www.youtube.com/watch?v=abc123&t=90s' }
    render(<PhotoModal work={work} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
  })

  it('youtubeId에 embed 링크가 들어있어도 영상 ID만 추출해 재생한다', () => {
    const work = { ...legacyYoutubeWork, youtubeId: 'https://www.youtube.com/embed/abc123' }
    render(<PhotoModal work={work} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
  })

  it('youtubeId가 순수 영상 ID면 그대로 재생한다', () => {
    render(<PhotoModal work={legacyYoutubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
  })
})
