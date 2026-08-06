import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StorageFileList from '../admin/sections/StorageFileList'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockGetPublicUrl() {
  const getPublicUrl = vi.fn(name => ({
    data: { publicUrl: `https://example.com/storage/v1/object/public/media/${name}` },
  }))
  supabase.storage.from.mockReturnValue({ getPublicUrl })
  return getPublicUrl
}

describe('StorageFileList', () => {
  it('파일이 없으면 안내 문구를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[]} onDelete={vi.fn()} />)
    expect(screen.getByText('파일이 없습니다.')).toBeInTheDocument()
  })

  it('파일마다 썸네일과 체크박스를 표시하고, 선택 전에는 삭제 버튼이 없다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={vi.fn()} />)

    expect(screen.getByAltText('a.jpg')).toHaveAttribute(
      'src',
      'https://example.com/storage/v1/object/public/media/a.jpg'
    )
    expect(screen.queryByRole('button', { name: /선택 삭제/ })).not.toBeInTheDocument()
  })

  it('체크박스를 선택하면 "선택 삭제(N)" 버튼이 나타나고, 클릭+확인하면 선택된 이름으로 onDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn().mockResolvedValue()

    render(
      <StorageFileList
        files={[{ name: 'a.jpg', size: 1024 }, { name: 'b.jpg', size: 2048 }]}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    expect(screen.getByRole('button', { name: '선택 삭제(1)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    expect(confirmSpy).toHaveBeenCalledWith('선택한 1개 파일을 휴지통으로 이동할까요?')
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(['a.jpg']))

    confirmSpy.mockRestore()
  })

  it('확인 대화상자에서 취소하면 onDelete를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()

    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={onDelete} />)

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
