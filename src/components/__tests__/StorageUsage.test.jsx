import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import StorageUsage from '../admin/sections/StorageUsage'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() }, from: vi.fn() },
}))

function mockStorage({ root = [], trash = [], content = [] } = {}) {
  const list = vi.fn(path => {
    if (path === 'trash') return Promise.resolve({ data: trash, error: null })
    return Promise.resolve({ data: root, error: null })
  })
  const getPublicUrl = vi.fn((name, options) => ({
    data: {
      publicUrl: options?.transform
        ? `https://example.com/storage/v1/render/image/public/media/${name}?width=${options.transform.width}&height=${options.transform.height}&quality=${options.transform.quality}`
        : `https://example.com/storage/v1/object/public/media/${name}`,
    },
  }))
  const move = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  supabase.storage.from.mockReturnValue({ list, getPublicUrl, move, remove })

  const select = vi.fn().mockResolvedValue({
    data: content.map(data => ({ data })),
    error: null,
  })
  supabase.from.mockReturnValue({ select })

  return { list, getPublicUrl, move, remove, select }
}

describe('StorageUsage', () => {
  it('루트 파일과 휴지통 파일의 합계를 총 사용량으로 표시한다', async () => {
    mockStorage({
      root: [
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 * 1024 } },
      ],
      trash: [
        { id: '2', name: 'b.jpg', updated_at: new Date().toISOString(), metadata: { size: 2 * 1024 * 1024 } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('3.0MB')
  })

  it('폴더 플레이스홀더 항목은 목록/합계에서 제외한다', async () => {
    mockStorage({
      root: [
        { id: null, name: 'trash', updated_at: null, metadata: null },
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 * 1024 } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('1.0MB')
  })

  it('용량 큰 파일 Top 10을 내림차순으로 표시한다', async () => {
    mockStorage({
      root: [
        { id: '1', name: 'small.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
        { id: '2', name: 'big.jpg', updated_at: new Date().toISOString(), metadata: { size: 5 * 1024 * 1024 } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('용량 큰 파일 Top 10')
    const list = screen.getByText('용량 큰 파일 Top 10').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('big.jpg')
    expect(items[1]).toHaveTextContent('small.jpg')
  })

  it('용량 큰 파일 항목에 썸네일 미리보기와 원본 링크를 표시한다', async () => {
    mockStorage({
      root: [{ id: '1', name: 'big.jpg', updated_at: new Date().toISOString(), metadata: { size: 5 * 1024 * 1024 } }],
    })

    render(<StorageUsage />)

    await screen.findByText('용량 큰 파일 Top 10')
    const img = screen.getByAltText('big.jpg')
    expect(img).toHaveAttribute(
      'src',
      'https://example.com/storage/v1/render/image/public/media/big.jpg?width=80&height=80&quality=50'
    )
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')

    const link = img.closest('a')
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/storage/v1/object/public/media/big.jpg'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('루트 파일이 없으면 Top 10에 안내 문구를 표시한다', async () => {
    mockStorage({ root: [] })

    render(<StorageUsage />)

    await screen.findByText('파일이 없습니다.')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    let rootCallCount = 0
    const list = vi.fn(path => {
      if (path === 'trash') return Promise.resolve({ data: [], error: null })
      rootCallCount += 1
      if (rootCallCount === 1) {
        return Promise.resolve({ data: null, error: { message: '권한 없음' } })
      }
      return Promise.resolve({ data: [], error: null })
    })
    const getPublicUrl = vi.fn(name => ({
      data: { publicUrl: `https://example.com/storage/v1/object/public/media/${name}` },
    }))
    supabase.storage.from.mockReturnValue({ list, getPublicUrl, move: vi.fn(), remove: vi.fn() })
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    render(<StorageUsage />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(rootCallCount).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('총 사용량')
    expect(rootCallCount).toBe(2)
  })

  it('14일 지난 휴지통 파일은 마운트 시 자동으로 영구 삭제한다', async () => {
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const recent = new Date().toISOString()
    const { remove } = mockStorage({
      trash: [
        { id: '1', name: 'old.jpg', updated_at: old, metadata: { size: 1024 } },
        { id: '2', name: 'recent.jpg', updated_at: recent, metadata: { size: 1024 } },
      ],
    })

    render(<StorageUsage />)

    await waitFor(() => expect(remove).toHaveBeenCalledWith(['trash/old.jpg']))
    await screen.findByText('휴지통 (14일 후 자동 삭제)')
    expect(screen.queryByAltText('old.jpg')).not.toBeInTheDocument()
    expect(screen.getByText('recent.jpg')).toBeInTheDocument()
  })

  it('"전체 파일 보기"를 열면 체크박스로 선택한 파일을 휴지통으로 이동한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { move } = mockStorage({
      root: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    fireEvent.click(screen.getByRole('button', { name: '전체 파일 보기' }))

    fireEvent.click(screen.getByLabelText('a.jpg 선택'))
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제(1)' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith('a.jpg', 'trash/a.jpg'))
    confirmSpy.mockRestore()
  })

  it('휴지통 항목의 "복원" 버튼을 누르면 원래 경로로 되돌린다', async () => {
    const { move } = mockStorage({
      trash: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '복원' }))
    fireEvent.click(screen.getByRole('button', { name: '복원' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith('trash/a.jpg', 'a.jpg'))
  })

  it('휴지통 항목의 "지금 영구 삭제" 버튼을 누르면 확인 후 즉시 삭제한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { remove } = mockStorage({
      trash: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '지금 영구 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: '지금 영구 삭제' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith(['trash/a.jpg']))
    confirmSpy.mockRestore()
  })

  it('게시된 콘텐츠에서 참조되지 않는 파일에는 미사용 배지를, 참조되는 파일에는 표시하지 않는다', async () => {
    mockStorage({
      root: [
        { id: '1', name: 'used.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
        { id: '2', name: 'orphan.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
      ],
      content: [
        { hero: { imageUrl: 'https://example.com/storage/v1/object/public/media/used.jpg' } },
      ],
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    fireEvent.click(screen.getByRole('button', { name: '전체 파일 보기' }))

    const usedItem = screen.getByLabelText('used.jpg 선택').closest('li')
    const orphanItem = screen.getByLabelText('orphan.jpg 선택').closest('li')
    await waitFor(() => expect(within(orphanItem).getByText('미사용')).toBeInTheDocument())
    expect(within(usedItem).queryByText('미사용')).not.toBeInTheDocument()
  })

  it('site_content 조회 실패 시 에러 상태로 전환된다', async () => {
    mockStorage({ root: [{ id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } }] })
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: '실패' } }),
    })

    render(<StorageUsage />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
  })

  it('"휴지통 비우기"를 클릭하면 휴지통의 모든 파일을 한 번에 영구 삭제한다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { remove } = mockStorage({
      trash: [
        { id: '1', name: 'a.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
        { id: '2', name: 'b.jpg', updated_at: new Date().toISOString(), metadata: { size: 1024 } },
      ],
    })

    render(<StorageUsage />)

    await waitFor(() => screen.getByRole('button', { name: '휴지통 비우기' }))
    fireEvent.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(expect.arrayContaining(['trash/a.jpg', 'trash/b.jpg']))
    )
    confirmSpy.mockRestore()
  })
})
