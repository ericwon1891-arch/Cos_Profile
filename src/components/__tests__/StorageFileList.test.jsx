import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('usedPaths에 없는 파일에는 "미사용" 배지를 표시한다', () => {
    mockGetPublicUrl()
    render(
      <StorageFileList
        files={[{ name: 'used.jpg', size: 1024 }, { name: 'orphan.jpg', size: 1024 }]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={vi.fn()}
      />
    )

    const usedItem = screen.getByText('used.jpg').closest('li')
    const orphanItem = screen.getByText('orphan.jpg').closest('li')
    expect(within(usedItem).queryByText('미사용')).not.toBeInTheDocument()
    expect(within(orphanItem).getByText('미사용')).toBeInTheDocument()
  })

  it('usedPaths를 생략하면 모든 파일에 "미사용" 배지를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageFileList files={[{ name: 'a.jpg', size: 1024 }]} onDelete={vi.fn()} />)
    expect(screen.getByText('미사용')).toBeInTheDocument()
  })

  it('미사용 파일이 없으면 "미사용 파일 정리" 버튼이 보이지 않는다', () => {
    mockGetPublicUrl()
    render(
      <StorageFileList
        files={[{ name: 'used.jpg', size: 1024 }]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /미사용 파일 정리/ })).not.toBeInTheDocument()
  })

  it('"미사용 파일 정리(N)" 버튼을 클릭+확인하면 미사용 파일 전체로 onDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn().mockResolvedValue()

    render(
      <StorageFileList
        files={[
          { name: 'used.jpg', size: 1024 },
          { name: 'orphan1.jpg', size: 1024 },
          { name: 'orphan2.jpg', size: 1024 },
        ]}
        usedPaths={new Set(['used.jpg'])}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '미사용 파일 정리(2)' }))

    expect(confirmSpy).toHaveBeenCalledWith('미사용 파일 2개를 휴지통으로 이동할까요?')
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(['orphan1.jpg', 'orphan2.jpg']))

    confirmSpy.mockRestore()
  })

  it('"미사용 파일 정리" 확인 대화상자에서 취소하면 onDelete를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()

    render(<StorageFileList files={[{ name: 'orphan.jpg', size: 1024 }]} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: '미사용 파일 정리(1)' }))

    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
