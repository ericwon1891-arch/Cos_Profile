import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VisitorAnalytics from '../admin/sections/VisitorAnalytics'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

const rows = [
  { created_at: '2026-08-01T01:00:00.000Z', referrer: 'https://instagram.com/x', visitor_id: 'a' },
  { created_at: '2026-08-01T02:00:00.000Z', referrer: 'https://instagram.com/y', visitor_id: 'b' },
  { created_at: '2026-08-02T01:00:00.000Z', referrer: null, visitor_id: 'a' },
]

// 실제 supabase-js 쿼리 빌더는 .gte()를 체이닝하지 않고 바로 await해도 동작하고,
// .gte()를 체이닝한 뒤에도 동일하게 동작한다(둘 다 thenable) — 이 목으로 두 경로를 모두 재현한다.
function makeQueryBuilder(result) {
  return {
    gte: vi.fn(() => makeQueryBuilder(result)),
    then: (resolve) => resolve(result),
  }
}

function mockSelect(result) {
  const select = vi.fn().mockReturnValue(makeQueryBuilder(result))
  supabase.from.mockReturnValue({ select })
  return { select }
}

describe('VisitorAnalytics', () => {
  it('로딩 후 총 방문 수와 순 방문자 수를 표시한다', async () => {
    mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    // '3'/'2' 같은 숫자만으로 getByText를 쓰면 유입 경로 목록의 카운트(예: instagram.com 옆의 '2')와
    // 같은 텍스트가 겹쳐 여러 엘리먼트가 매치될 수 있으므로, 라벨의 다음 형제 엘리먼트를 지정해 조회한다.
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('순 방문자 수').nextElementSibling).toHaveTextContent('2')
  })

  it('유입 경로를 방문 횟수 내림차순으로 표시한다', async () => {
    mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)

    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('instagram.com')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('직접 방문')
  })

  it('"전체" 기간을 클릭하면 gte 없이 조회하고 결과를 다시 표시한다', async () => {
    const { select } = mockSelect({ data: rows, error: null })
    render(<VisitorAnalytics />)
    await screen.findByText('총 방문 수')

    fireEvent.click(screen.getByRole('button', { name: '전체' }))

    await waitFor(() => expect(select).toHaveBeenCalledTimes(2))
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const { select } = mockSelect({ data: null, error: { message: '권한 없음' } })
    render(<VisitorAnalytics />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(select).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(select).toHaveBeenCalledTimes(2))
  })
})
