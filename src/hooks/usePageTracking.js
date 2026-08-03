import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertPageView } from '../lib/tracking'

export function usePageTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

    insertPageView({
      path: location.pathname,
      referrer: document.referrer || null,
      visitorId: getOrCreateVisitorId(),
    })
  }, [location.pathname, session, loading])
}
