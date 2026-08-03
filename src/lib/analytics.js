const VISITOR_ID_KEY = 'cosplay_visitor_id'

export function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

export function getReferrerDomain(referrer, currentHostname = window.location.hostname) {
  if (!referrer) return '직접 방문'
  try {
    const { hostname } = new URL(referrer)
    return hostname === currentHostname ? '직접 방문' : hostname
  } catch {
    return '직접 방문'
  }
}

export function groupByDate(rows) {
  const counts = {}
  for (const row of rows) {
    const date = row.created_at.slice(0, 10)
    counts[date] = (counts[date] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

export function topReferrers(rows, limit = 5) {
  const counts = {}
  for (const row of rows) {
    const domain = getReferrerDomain(row.referrer)
    counts[domain] = (counts[domain] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }))
}

export function countUniqueVisitors(rows) {
  return new Set(rows.map(row => row.visitor_id)).size
}

export function canTrackVisit({ pathname, session, loading }) {
  if (loading) return false
  if (session) return false
  return !pathname.startsWith('/admin')
}

export function averageDuration(rows) {
  if (rows.length === 0) return null
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return Math.round(total / rows.length)
}

export function formatDuration(seconds) {
  if (seconds === null) return '-'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}분 ${remaining}초`
}

function countByLabel(rows, limit = Infinity) {
  const counts = {}
  for (const row of rows) {
    counts[row.label] = (counts[row.label] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

export function sectionViewCounts(rows) {
  return countByLabel(rows)
}

export function topCharacterClicks(rows, limit = 5) {
  return countByLabel(rows, limit)
}
