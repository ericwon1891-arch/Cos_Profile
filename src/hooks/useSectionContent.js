import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSectionContent(section) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase
      .from('site_content')
      .select('data')
      .eq('section', section)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err)
        } else {
          setData(row?.data ?? null)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [section])

  return { data, loading, error }
}
