import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import VisitorAnalytics from '../admin/sections/VisitorAnalytics'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

const viewRows = [
  { created_at: '2026-08-01T01:00:00.000Z', referrer: 'https://instagram.com/x', visitor_id: 'a' },
  { created_at: '2026-08-01T02:00:00.000Z', referrer: 'https://instagram.com/y', visitor_id: 'b' },
  { created_at: '2026-08-02T01:00:00.000Z', referrer: null, visitor_id: 'a' },
]

const eventRows = [
  { event_type: 'duration', label: null, value: 100 },
  { event_type: 'duration', label: null, value: 200 },
  { event_type: 'section_view', label: 'Hero', value: null },
  { event_type: 'section_view', label: 'Hero', value: null },
  { event_type: 'section_view', label: 'Contact', value: null },
  { event_type: 'character_click', label: '캐릭터A', value: null },
  { event_type: 'character_click', label: '캐릭터A', value: null },
  { event_type: 'character_click', label: '캐릭터B', value: null },
]

// 실제 supabase-js 쿼리 빌더는 .gte()를 체이닝하지 않고 바로 await해도 동작하고,
// .gte()를 체이닝한 뒤에도 동일하게 동작한다(둘 다 thenable) — 이 목으로 두 경로를 모두 재현한다.
function makeQueryBuilder(result) {
  return {
    gte: vi.fn(() => makeQueryBuilder(result)),
    then: (resolve) => resolve(result),
  }
}

function mockFrom({ pageViews, pageEvents }) {
  const selectViews = vi.fn().mockReturnValue(makeQueryBuilder(pageViews))
  const selectEvents = vi.fn().mockReturnValue(makeQueryBuilder(pageEvents))
  supabase.from.mockImplementation(table => {
    if (table === 'page_views') return { select: selectViews }
    if (table === 'page_events') return { select: selectEvents }
    throw new Error(`unexpected table: ${table}`)
  })
  return { selectViews, selectEvents }
}

describe('VisitorAnalytics', () => {
  it('로딩 후 총 방문 수, 순 방문자 수, 평균 체류 시간을 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('순 방문자 수').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('평균 체류 시간').nextElementSibling).toHaveTextContent('2분 30초')
  })

  it('유입 경로를 방문 횟수 내림차순으로 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('유입 경로 Top 5')
    const list = screen.getByText('유입 경로 Top 5').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('instagram.com')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('직접 방문')
  })

  it('섹션별 조회수를 내림차순으로 전체 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('섹션별 조회수')
    const list = screen.getByText('섹션별 조회수').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Hero')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('Contact')
  })

  it('인기 캐릭터를 클릭 수 내림차순 상위 5개까지 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: eventRows, error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('인기 캐릭터 Top 5')
    const list = screen.getByText('인기 캐릭터 Top 5').nextElementSibling
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('캐릭터A')
    expect(items[0]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('캐릭터B')
  })

  it('참여도 이벤트가 없으면 평균 체류 시간은 -, 섹션/캐릭터 목록은 데이터 없음을 표시한다', async () => {
    mockFrom({ pageViews: { data: viewRows, error: null }, pageEvents: { data: [], error: null } })
    render(<VisitorAnalytics />)

    await screen.findByText('총 방문 수')
    expect(screen.getByText('평균 체류 시간').nextElementSibling).toHaveTextContent('-')
    expect(screen.getAllByText('데이터가 없습니다.')).toHaveLength(2)
  })

  it('"전체" 기간을 클릭하면 page_views/page_events 모두 gte 없이 재조회한다', async () => {
    const { selectViews, selectEvents } = mockFrom({
      pageViews: { data: viewRows, error: null },
      pageEvents: { data: eventRows, error: null },
    })
    render(<VisitorAnalytics />)
    await screen.findByText('총 방문 수')

    fireEvent.click(screen.getByRole('button', { name: '전체' }))

    await waitFor(() => expect(selectViews).toHaveBeenCalledTimes(2))
    expect(selectEvents).toHaveBeenCalledTimes(2)
    expect(screen.getByText('총 방문 수').nextElementSibling).toHaveTextContent('3')
  })

  it('조회 실패 시 에러 메시지와 다시 시도 버튼을 표시하고, 클릭하면 재조회한다', async () => {
    const { selectViews } = mockFrom({
      pageViews: { data: null, error: { message: '권한 없음' } },
      pageEvents: { data: eventRows, error: null },
    })
    render(<VisitorAnalytics />)

    await screen.findByText('데이터를 불러오지 못했습니다.')
    expect(selectViews).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(selectViews).toHaveBeenCalledTimes(2))
  })
})
