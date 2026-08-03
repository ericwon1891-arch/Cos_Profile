import {
  getOrCreateVisitorId,
  getReferrerDomain,
  groupByDate,
  topReferrers,
  countUniqueVisitors,
  canTrackVisit,
  averageDuration,
  formatDuration,
  sectionViewCounts,
  topCharacterClicks,
} from './analytics'

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

describe('canTrackVisit', () => {
  it('loading 중이면 false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: null, loading: true })).toBe(false)
  })

  it('세션이 있으면(관리자) false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: { user: { id: '1' } }, loading: false })).toBe(false)
  })

  it('/admin 경로면 false를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/admin', session: null, loading: false })).toBe(false)
  })

  it('로딩이 끝났고 세션이 없고 /admin이 아니면 true를 반환한다', () => {
    expect(canTrackVisit({ pathname: '/', session: null, loading: false })).toBe(true)
  })
})

describe('averageDuration', () => {
  it('value들의 평균을 반올림해 반환한다', () => {
    const rows = [{ value: 10 }, { value: 15 }, { value: 20 }]
    expect(averageDuration(rows)).toBe(15)
  })

  it('행이 없으면 null을 반환한다', () => {
    expect(averageDuration([])).toBeNull()
  })
})

describe('formatDuration', () => {
  it('초를 "N분 M초" 형식으로 변환한다', () => {
    expect(formatDuration(125)).toBe('2분 5초')
  })

  it('null이면 -을 반환한다', () => {
    expect(formatDuration(null)).toBe('-')
  })
})

describe('sectionViewCounts', () => {
  it('label별로 세어 내림차순 전체를 반환한다', () => {
    const rows = [{ label: 'Hero' }, { label: 'Hero' }, { label: 'Contact' }]
    expect(sectionViewCounts(rows)).toEqual([
      { label: 'Hero', count: 2 },
      { label: 'Contact', count: 1 },
    ])
  })
})

describe('topCharacterClicks', () => {
  it('label별로 세어 내림차순 상위 N개를 반환한다', () => {
    const rows = [{ label: 'A' }, { label: 'A' }, { label: 'B' }, { label: 'C' }]
    expect(topCharacterClicks(rows, 2)).toEqual([
      { label: 'A', count: 2 },
      { label: 'B', count: 1 },
    ])
  })
})
