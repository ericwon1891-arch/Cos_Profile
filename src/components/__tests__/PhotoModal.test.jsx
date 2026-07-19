import { render, screen, fireEvent } from '@testing-library/react'
import PhotoModal from '../PhotoModal'

const photoWork = {
  id: 1,
  title: '테스트 사진',
  type: 'photo',
  src: '/photos/test.jpg',
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
})
