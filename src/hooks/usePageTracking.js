import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'
import { getOrCreateVisitorId } from '../lib/analytics'

export function usePageTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (session) return
    if (location.pathname.startsWith('/admin')) return

    supabase
      .from('page_views')
      .insert({
        path: location.pathname,
        referrer: document.referrer || null,
        visitor_id: getOrCreateVisitorId(),
      })
      .then(({ error }) => {
        if (error) console.error('페이지뷰 기록 실패', error)
      })
  }, [location.pathname, session, loading])
}
