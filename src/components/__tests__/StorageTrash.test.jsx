import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StorageTrash from '../admin/sections/StorageTrash'
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

describe('StorageTrash', () => {
  it('휴지통이 비어 있으면 안내 문구를 표시한다', () => {
    mockGetPublicUrl()
    render(<StorageTrash files={[]} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)
    expect(screen.getByText('휴지통이 비어 있습니다.')).toBeInTheDocument()
  })

  it('원래 파일명과 남은 보관일을 표시한다', () => {
    mockGetPublicUrl()
    const updatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt }]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('11일 후 영구 삭제')).toBeInTheDocument()
  })

  it('"복원" 버튼을 누르면 onRestore를 원래(휴지통) 경로로 호출한다', () => {
    mockGetPublicUrl()
    const onRestore = vi.fn()
    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={onRestore}
        onPermanentDelete={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '복원' }))
    expect(onRestore).toHaveBeenCalledWith('trash/a.jpg')
  })

  it('"지금 영구 삭제" 버튼을 누르면 확인 후 onPermanentDelete를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onPermanentDelete = vi.fn().mockResolvedValue()

    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={vi.fn()}
        onPermanentDelete={onPermanentDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '지금 영구 삭제' }))

    expect(confirmSpy).toHaveBeenCalledWith('이 파일을 지금 영구 삭제할까요? 되돌릴 수 없습니다.')
    await waitFor(() => expect(onPermanentDelete).toHaveBeenCalledWith('trash/a.jpg'))

    confirmSpy.mockRestore()
  })

  it('"휴지통 비우기" 버튼을 클릭+확인하면 onEmptyTrash를 호출한다', async () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onEmptyTrash = vi.fn().mockResolvedValue()

    render(
      <StorageTrash
        files={[
          { name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() },
          { name: 'trash/b.jpg', size: 1024, updatedAt: new Date().toISOString() },
        ]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyTrash={onEmptyTrash}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    expect(confirmSpy).toHaveBeenCalledWith('휴지통의 파일 2개를 전부 영구 삭제할까요? 되돌릴 수 없습니다.')
    await waitFor(() => expect(onEmptyTrash).toHaveBeenCalled())

    confirmSpy.mockRestore()
  })

  it('"휴지통 비우기" 확인 대화상자에서 취소하면 onEmptyTrash를 호출하지 않는다', () => {
    mockGetPublicUrl()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onEmptyTrash = vi.fn()

    render(
      <StorageTrash
        files={[{ name: 'trash/a.jpg', size: 1024, updatedAt: new Date().toISOString() }]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onEmptyTrash={onEmptyTrash}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    expect(onEmptyTrash).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
