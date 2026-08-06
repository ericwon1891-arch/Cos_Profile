import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { formatBytes } from '../../../lib/storageUsage'

export default function StorageFileList({ files, usedPaths = new Set(), onDelete }) {
  const [selected, setSelected] = useState([])

  function toggle(name) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  async function handleDeleteClick() {
    if (!confirm(`선택한 ${selected.length}개 파일을 휴지통으로 이동할까요?`)) return
    await onDelete(selected)
    setSelected([])
  }

  if (files.length === 0) {
    return <p className="text-sm text-gray-400">파일이 없습니다.</p>
  }

  return (
    <div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="mb-2 text-sm text-red-600 underline"
        >
          선택 삭제({selected.length})
        </button>
      )}
      <ul className="space-y-1">
        {files.map(f => {
          const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
          return (
            <li key={f.name} className="flex items-center justify-between text-sm border-b py-1">
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={selected.includes(f.name)}
                  onChange={() => toggle(f.name)}
                  aria-label={`${f.name} 선택`}
                />
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <img
                    src={publicUrl}
                    alt={f.name}
                    className="w-10 h-10 object-cover rounded shrink-0"
                  />
                </a>
                <span className="truncate">{f.name}</span>
                {!usedPaths.has(f.name) && (
                  <span className="text-xs text-orange-600 border border-orange-300 rounded px-1 shrink-0">
                    미사용
                  </span>
                )}
              </span>
              <span className="text-gray-500 shrink-0">{formatBytes(f.size)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
