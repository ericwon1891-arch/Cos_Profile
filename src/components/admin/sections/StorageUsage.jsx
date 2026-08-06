import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  STORAGE_LIMIT_GB,
} from '../../../lib/storageUsage'

export default function StorageUsage() {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ files: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ files: null, loading: true, error: null })

    async function fetchFiles() {
      try {
        const files = await fetchAllStorageFiles((offset, limit) =>
          supabase.storage.from('media').list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
        )
        if (cancelled) return
        setState({ files, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ files: null, loading: false, error })
      }
    }

    fetchFiles()

    return () => { cancelled = true }
  }, [reloadToken])

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

  const files = state.files
  const usedBytes = totalBytes(files)
  const percent = usagePercent(usedBytes, STORAGE_LIMIT_GB)
  const largest = topLargestFiles(files, 10)

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">총 사용량</p>
          <p className="text-2xl font-bold">{formatBytes(usedBytes)}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">한도 대비 사용률 (Free {STORAGE_LIMIT_GB}GB 기준)</p>
          <p className="text-2xl font-bold">{percent}%</p>
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mb-2">용량 큰 파일 Top 10</h3>
      {largest.length === 0 && <p className="text-sm text-gray-400">파일이 없습니다.</p>}
      {largest.length > 0 && (
        <ul className="space-y-1">
          {largest.map(f => {
            const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
            return (
              <li key={f.name} className="flex items-center justify-between text-sm border-b py-1">
                <span className="flex items-center gap-2 min-w-0">
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <img
                      src={publicUrl}
                      alt={f.name}
                      className="w-10 h-10 object-cover rounded shrink-0"
                    />
                  </a>
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-gray-500 shrink-0">{formatBytes(f.size)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
