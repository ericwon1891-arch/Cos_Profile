import { getOrCreateVisitorId, getReferrerDomain, groupByDate, topReferrers, countUniqueVisitors } from './analytics'

describe('getOrCreateVisitorId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('처음 호출 시 UUID를 생성해 localStorage에 저장한다', () => {
    const id = getOrCreateVisitorId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('cosplay_visitor_id')).toBe(id)
  })

  it('이미 저장된 값이 있으면 재사용한다', () => {
    localStorage.setItem('cosplay_visitor_id', 'existing-id')
    expect(getOrCreateVisitorId()).toBe('existing-id')
  })
})

describe('getReferrerDomain', () => {
  it('referrer가 없으면 직접 방문을 반환한다', () => {
    expect(getReferrerDomain(null, 'cos-profile.vercel.app')).toBe('직접 방문')
    expect(getReferrerDomain('', 'cos-profile.vercel.app')).toBe('직접 방문')
  })

  it('같은 도메인에서 온 referrer는 직접 방문으로 취급한다', () => {
    expect(getReferrerDomain('https://cos-profile.vercel.app/admin', 'cos-profile.vercel.app')).toBe('직접 방문')
  })

  it('외부 도메인은 hostname을 반환한다', () => {
    expect(getReferrerDomain('https://www.instagram.com/x', 'cos-profile.vercel.app')).toBe('www.instagram.com')
  })

  it('잘못된 URL 형식이면 직접 방문을 반환한다', () => {
    expect(getReferrerDomain('not-a-url', 'cos-profile.vercel.app')).toBe('직접 방문')
  })
})

describe('groupByDate', () => {
  it('날짜별로 개수를 세고 오름차순 정렬한다', () => {
    const rows = [
      { created_at: '2026-08-02T01:00:00.000Z' },
      { created_at: '2026-08-01T23:00:00.000Z' },
      { created_at: '2026-08-02T10:00:00.000Z' },
    ]
    expect(groupByDate(rows)).toEqual([
      { date: '2026-08-01', count: 1 },
      { date: '2026-08-02', count: 2 },
    ])
  })
})

describe('topReferrers', () => {
  it('방문 횟수 내림차순으로 상위 N개를 반환한다', () => {
    const rows = [
      { referrer: 'https://instagram.com/x' },
      { referrer: 'https://instagram.com/y' },
      { referrer: 'https://google.com/search' },
      { referrer: null },
    ]
    expect(topReferrers(rows, 2)).toEqual([
      { domain: 'instagram.com', count: 2 },
      { domain: 'google.com', count: 1 },
    ])
  })
})

describe('countUniqueVisitors', () => {
  it('distinct visitor_id 개수를 센다', () => {
    const rows = [{ visitor_id: 'a' }, { visitor_id: 'b' }, { visitor_id: 'a' }]
    expect(countUniqueVisitors(rows)).toBe(2)
  })
})
