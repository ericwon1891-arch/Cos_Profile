import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { groupByDate, topReferrers, countUniqueVisitors } from '../../../lib/analytics'

const RANGES = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'all', label: '전체', days: null },
]

export default function VisitorAnalytics() {
  const [rangeKey, setRangeKey] = useState('7d')
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ rows: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: null, loading: true, error: null })

    async function fetchRows() {
      const range = RANGES.find(r => r.key === rangeKey)
      let query = supabase.from('page_views').select('created_at, referrer, visitor_id')
      if (range.days !== null) {
        const since = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', since)
      }
      const { data, error } = await query
      if (cancelled) return
      setState({ rows: error ? null : data, loading: false, error: error ?? null })
    }

    fetchRows()

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
  const daily = groupByDate(rows)
  const referrers = topReferrers(rows)
  const maxCount = Math.max(1, ...daily.map(d => d.count))

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

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 방문 수</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">순 방문자 수</p>
          <p className="text-2xl font-bold">{countUniqueVisitors(rows)}</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">일별 방문 추이</h3>
      {daily.length === 0 && <p className="text-sm text-gray-400 mb-8">데이터가 없습니다.</p>}
      {daily.length > 0 && (
        <div className="flex items-end gap-1 h-32 mb-8">
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
      {referrers.length === 0 && <p className="text-sm text-gray-400">데이터가 없습니다.</p>}
      {referrers.length > 0 && (
        <ul className="space-y-1">
          {referrers.map(r => (
            <li key={r.domain} className="flex justify-between text-sm border-b py-1">
              <span>{r.domain}</span>
              <span className="text-gray-500">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
