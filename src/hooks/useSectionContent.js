import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSectionContent(section) {
  const [state, setState] = useState({ section: null, data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    supabase
      .from('site_content')
      .select('data')
      .eq('section', section)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return
        setState({ section, data: err ? null : (row?.data ?? null), loading: false, error: err ?? null })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ section, data: null, loading: false, error: err })
      })

    return () => { cancelled = true }
  }, [section])

  // If `section` just changed, `state` may still hold the previous section's
  // result until the effect above resolves. Report loading/null rather than
  // handing a mismatched-shape payload to the caller for that render.
  const isCurrent = state.section === section
  return {
    data: isCurrent ? state.data : null,
    loading: isCurrent ? state.loading : true,
    error: isCurrent ? state.error : null,
  }
}
