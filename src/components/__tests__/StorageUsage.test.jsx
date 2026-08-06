import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import StorageUsage from '../admin/sections/StorageUsage'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function mockList(result) {
  const list = vi.fn().mockResolvedValue(result)
  supabase.storage.from.mockReturnValue({ list })
  return list
}

describe('StorageUsage', () => {
  it('총 사용량을 표시한다', async () => {
    mockList({
      data: [
        { name: 'a.jpg', metadata: { size: 1024 * 1024 } },
        { name: 'b.jpg', metadata: { size: 2 * 1024 * 1024 } },
      ],
      error: null,
    })

    render(<StorageUsage />)

    await screen.findByText('총 사용량')
    expect(screen.getByText('총 사용량').nextElementSibling).toHaveTextContent('3.0MB')
  })

  it('용량 큰 파일 Top 10을 내림차순으로 표시한다', async () => {
    mockList({
      data: [
        { name: 'small.jpg', metadata: { size: 1024 } },
        { name: 'big.jpg', metadata: { size: 5 * 1024 * 1024 } },
      ],
      error: null,
    })

    render(<StorageUsage />)

    await screen.findByText('용량 큰 파일 Top 10')
    const list = screen.getByText('용량 큰 파일 Top 10').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('big.jpg')
    expect(items[1]).toHaveTextContent('small.jpg')
  })

  it('파일이 없으면 안내 문구를 표시한다', async () => {
    mockList({ data: [], error: null })

    render(<StorageUsage />)

    await screen.findByText('파일이 없습니다.')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: { message: '권한 없음' } })
    supabase.storage.from.mockReturnValue({ list })

    render(<StorageUsage />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(list).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })
})
