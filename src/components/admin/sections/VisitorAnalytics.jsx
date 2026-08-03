import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  groupByDate,
  topReferrers,
  countUniqueVisitors,
  averageDuration,
  formatDuration,
  sectionViewCounts,
  topCharacterClicks,
} from '../../../lib/analytics'

const RANGES = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'all', label: '전체', days: null },
]

export default function VisitorAnalytics() {
  const [rangeKey, setRangeKey] = useState('7d')
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ rows: null, eventRows: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: null, eventRows: null, loading: true, error: null })

    async function fetchAll() {
      const range = RANGES.find(r => r.key === rangeKey)
      const since = range.days !== null
        ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
        : null

      function withRange(query) {
        return since !== null ? query.gte('created_at', since) : query
      }

      const [viewsResult, eventsResult] = await Promise.all([
        withRange(supabase.from('page_views').select('created_at, referrer, visitor_id')),
        withRange(supabase.from('page_events').select('event_type, label, value')),
      ])

      if (cancelled) return

      const error = viewsResult.error ?? eventsResult.error
      if (error) {
        setState({ rows: null, eventRows: null, loading: false, error })
        return
      }
      setState({ rows: viewsResult.data, eventRows: eventsResult.data, loading: false, error: null })
    }

    fetchAll()

    return () => { cancelled = true }
  }, [rangeKey, reloadToken])

  if (state.loading) {
    return <p className="text-gray-500 text-sm">불러오는 중...</p>
  }

  if (state.error) {
    return (
      <div className="text-sm text-red-500">
        데이터를 불러오지 못했습니다.
        <button
          type="button"
          onClick={() => setReloadToken(t => t + 1)}
          className="ml-2 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const rows = state.rows
  const eventRows = state.eventRows
  const daily = groupByDate(rows)
  const referrers = topReferrers(rows)
  const maxCount = Math.max(1, ...daily.map(d => d.count))

  const durationRows = eventRows.filter(e => e.event_type === 'duration')
  const sectionRows = eventRows.filter(e => e.event_type === 'section_view')
  const characterRows = eventRows.filter(e => e.event_type === 'character_click')
  const avgDuration = averageDuration(durationRows)
  const sectionCounts = sectionViewCounts(sectionRows)
  const topCharacters = topCharacterClicks(characterRows)

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1 rounded text-sm ${
              rangeKey === r.key ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 방문 수</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">순 방문자 수</p>
          <p className="text-2xl font-bold">{countUniqueVisitors(rows)}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">평균 체류 시간</p>
          <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">일별 방문 추이</h3>
      {daily.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {daily.length > 0 && (
        <div className="flex items-stretch gap-1 h-32 mb-8">
          {daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-gray-900 rounded-t"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
                title={`${d.date}: ${d.count}`}
              />
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">유입 경로 Top 5</h3>
      {referrers.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {referrers.length > 0 && (
        <ul className="space-y-1 mb-8">
          {referrers.map(r => (
            <li key={r.domain} className="flex justify-between text-sm border-b py-1">
              <span>{r.domain}</span>
              <span className="text-gray-500">{r.count}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">섹션별 조회수</h3>
      {sectionCounts.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {sectionCounts.length > 0 && (
        <ul className="space-y-1 mb-8">
          {sectionCounts.map(s => (
            <li key={s.label} className="flex justify-between text-sm border-b py-1">
              <span>{s.label}</span>
              <span className="text-gray-500">{s.count}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">인기 캐릭터 Top 5</h3>
      {topCharacters.length === 0 && <p className="text-sm text-gray-400">데이터가 없습니다.</p>}
      {topCharacters.length > 0 && (
        <ul className="space-y-1">
          {topCharacters.map(c => (
            <li key={c.label} className="flex justify-between text-sm border-b py-1">
              <span>{c.label}</span>
              <span className="text-gray-500">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
