import { render, screen, fireEvent } from '@testing-library/react'
import VideoModal from '../VideoModal'

const youtubeWork = {
  id: 1,
  title: '테스트 영상',
  type: 'youtube',
  youtubeId: 'abc123',
}
const localWork = {
  id: 2,
  title: '로컬 영상',
  type: 'local',
  src: '/videos/test.mp4',
}

describe('VideoModal', () => {
  it('YouTube 타입일 때 iframe을 렌더링한다', () => {
    render(<VideoModal work={youtubeWork} onClose={() => {}} />)
    const iframe = screen.getByTitle('video-player')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'))
  })

  it('local 타입일 때 video 엘리먼트를 렌더링한다', () => {
    render(<VideoModal work={localWork} onClose={() => {}} />)
    const video = screen.getByTestId('local-video')
    expect(video).toHaveAttribute('src', '/videos/test.mp4')
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<VideoModal work={youtubeWork} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /닫기/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<VideoModal work={youtubeWork} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
