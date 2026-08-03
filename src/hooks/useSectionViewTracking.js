import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canTrackVisit, getOrCreateVisitorId } from '../lib/analytics'
import { insertEvent } from '../lib/tracking'

export function useSectionViewTracking() {
  const location = useLocation()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!canTrackVisit({ pathname: location.pathname, session, loading })) return

    const seen = new Set()

    function handleIntersect(entries) {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const label = entry.target.dataset.trackLabel
        if (!label || seen.has(label)) continue
        seen.add(label)
        insertEvent({ eventType: 'section_view', label, visitorId: getOrCreateVisitorId() })
      }
    }

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.5 })

    function observeAll() {
      document.querySelectorAll('[data-track-label]').forEach(el => observer.observe(el))
    }

    observeAll()

    const mutationObserver = new MutationObserver(observeAll)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [location.pathname, session, loading])
}
