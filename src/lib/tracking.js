import { supabase } from './supabaseClient'

export function insertPageView({ path, referrer, visitorId }) {
  return supabase
    .from('page_views')
    .insert({ path, referrer, visitor_id: visitorId })
    .then(({ error }) => {
      if (error) console.error('페이지뷰 기록 실패', error)
    })
}

export function insertEvent({ eventType, label = null, value = null, visitorId }) {
  return supabase
    .from('page_events')
    .insert({ event_type: eventType, label, value, visitor_id: visitorId })
    .then(({ error }) => {
      if (error) console.error('이벤트 기록 실패', error)
    })
}
