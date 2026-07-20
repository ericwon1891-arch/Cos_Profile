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

  it('photos 필드가 없으면 화살표/카운터를 표시하지 않는다', () => {
    render(<PhotoModal work={photoWork} onClose={() => {}} />)
    expect(screen.queryByLabelText('다음 사진')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이전 사진')).not.toBeInTheDocument()
  })

  it('photos가 여러 장이면 첫 사진과 카운터를 표시한다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/a.jpg')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('다음 사진 버튼 클릭 시 다음 사진으로 넘어간다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음 사진'))
    expect(screen.getByAltText('갤러리 캐릭터')).toHaveAttribute('src', '/photos/b.jpg')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('첫 사진에서 이전 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    expect(screen.getByLabelText('이전 사진')).toBeDisabled()
  })

  it('마지막 사진에서 다음 버튼은 비활성화된다', () => {
    render(<PhotoModal work={galleryWork} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('다음 사진'))
    fireEvent.click(screen.getByLabelText('다음 사진'))
    expect(screen.getByLabelText('다음 사진')).toBeDisabled()
  })
})
