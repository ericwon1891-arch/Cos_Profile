import { supabase } from '../../../lib/supabaseClient'
import { formatBytes, daysUntilExpiry, stripTrashPrefix } from '../../../lib/storageUsage'

export default function StorageTrash({ files, onRestore, onPermanentDelete }) {
  if (files.length === 0) {
    return <p className="text-sm text-gray-400">휴지통이 비어 있습니다.</p>
  }

  async function handlePermanentDeleteClick(name) {
    if (!confirm('이 파일을 지금 영구 삭제할까요? 되돌릴 수 없습니다.')) return
    await onPermanentDelete(name)
  }

  return (
    <ul className="space-y-1">
      {files.map(f => {
        const publicUrl = supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl
        const displayName = stripTrashPrefix(f.name)
        const remaining = daysUntilExpiry(f.updatedAt)
        return (
          <li key={f.name} className="flex items-center justify-between text-sm border-b py-1 gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <img
                  src={publicUrl}
                  alt={displayName}
                  className="w-10 h-10 object-cover rounded shrink-0"
                />
              </a>
              <span className="truncate">{displayName}</span>
              <span className="text-gray-400 shrink-0">{formatBytes(f.size)}</span>
              <span className="text-gray-400 shrink-0">{remaining}일 후 영구 삭제</span>
            </span>
            <span className="flex gap-2 shrink-0">
              <button type="button" onClick={() => onRestore(f.name)} className="underline">
                복원
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDeleteClick(f.name)}
                className="underline text-red-600"
              >
                지금 영구 삭제
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
