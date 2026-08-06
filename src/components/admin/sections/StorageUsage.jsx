import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  isFolderPlaceholder,
  isExpired,
  stripTrashPrefix,
  describeStorageActionError,
  STORAGE_LIMIT_GB,
  TRASH_PREFIX,
} from '../../../lib/storageUsage'
import { extractMediaPaths } from '../../../lib/mediaUsage'
import StorageFileList from './StorageFileList'
import StorageTrash from './StorageTrash'

export default function StorageUsage() {
  const [reloadToken, setReloadToken] = useState(0)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const [state, setState] = useState({ rootFiles: null, trashFiles: null, usedPaths: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rootFiles: null, trashFiles: null, usedPaths: null, loading: true, error: null })

    async function fetchFiles() {
      try {
        const [rootRaw, trashRaw, contentRows] = await Promise.all([
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
          fetchAllStorageFiles((offset, limit) =>
            supabase.storage.from('media').list('trash', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          ),
          supabase.from('site_content').select('data').then(({ data, error }) => {
            if (error) throw error
            return data
          }),
        ])

        const rootFiles = rootRaw.filter(f => !isFolderPlaceholder(f))
        const trashPrefixed = trashRaw
          .filter(f => !isFolderPlaceholder(f))
          .map(f => ({ ...f, name: `${TRASH_PREFIX}${f.name}` }))

        const expired = trashPrefixed.filter(f => isExpired(f.updated_at))
        const active = trashPrefixed.filter(f => !isExpired(f.updated_at))

        if (expired.length > 0) {
          await supabase.storage.from('media').remove(expired.map(f => f.name))
        }

        const usedPaths = new Set(contentRows.flatMap(row => extractMediaPaths(row.data)))

        if (cancelled) return
        setState({ rootFiles, trashFiles: active, usedPaths, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ rootFiles: null, trashFiles: null, usedPaths: null, loading: false, error })
      }
    }

    fetchFiles()

    return () => { cancelled = true }
  }, [reloadToken])

  async function moveFiles(names, toTrash) {
    for (const name of names) {
      const targetPath = toTrash ? `${TRASH_PREFIX}${name}` : stripTrashPrefix(name)
      const { error } = await supabase.storage.from('media').move(name, targetPath)
      if (error) {
        alert(`작업 실패: ${describeStorageActionError(error)}`)
        return
      }
    }
    setReloadToken(t => t + 1)
  }

  async function handleDelete(names) {
    await moveFiles(names, true)
  }

  async function handleRestore(trashName) {
    await moveFiles([trashName], false)
  }

  async function handlePermanentDelete(trashName) {
    const { error } = await supabase.storage.from('media').remove([trashName])
    if (error) {
      alert(`작업 실패: ${describeStorageActionError(error)}`)
      return
    }
    setReloadToken(t => t + 1)
  }

  async function handleEmptyTrash() {
    const names = state.trashFiles.map(f => f.name)
    const { error } = await supabase.storage.from('media').remove(names)
    if (error) {
      alert(`작업 실패: ${describeStorageActionError(error)}`)
      return
    }
    setReloadToken(t => t + 1)
  }

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

  const { rootFiles, trashFiles, usedPaths } = state
  const usedBytes = totalBytes(rootFiles) + totalBytes(trashFiles)
  const percent = usagePercent(usedBytes, STORAGE_LIMIT_GB)
  const largest = topLargestFiles(rootFiles, 10)
  const allFiles = topLargestFiles(rootFiles, rootFiles.length)
  const trashList = trashFiles
    .map(f => ({ name: f.name, size: f.metadata?.size ?? 0, updatedAt: f.updated_at }))
    .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))

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
        <ul className="space-y-1 mb-8">
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

      <button
        type="button"
        onClick={() => setShowAllFiles(v => !v)}
        className="mb-2 text-sm underline"
      >
        {showAllFiles ? '전체 파일 접기' : '전체 파일 보기'}
      </button>
      {showAllFiles && (
        <div className="mb-8">
          <StorageFileList files={allFiles} usedPaths={usedPaths} onDelete={handleDelete} />
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 mb-2">휴지통 (14일 후 자동 삭제)</h3>
      <StorageTrash
        files={trashList}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
      />
    </div>
  )
}
