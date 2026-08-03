import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useVisitDuration() {
  const location = useLocation()
  const { session, loading } = useAuth()
  const startRef = useRef(Date.now())
  const sentRef = useRef(false)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'hidden') return
      if (sentRef.current) return
      if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

      sentRef.current = true
      const value = Math.round((Date.now() - startRef.current) / 1000)

      fetch(`${supabaseUrl}/rest/v1/page_events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          event_type: 'duration',
          value,
          visitor_id: getOrCreateVisitorId(),
        }),
      }).catch(err => console.error('체류 시간 기록 실패', err))
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [location.pathname, session, loading])
}
