export const STORAGE_LIMIT_GB = 1 // Free Plan 실측값(2026-08-05). 요금제 변경 시 이 값을 수정하세요.

export async function fetchAllStorageFiles(listPage, pageSize = 1000) {
  let offset = 0
  let all = []
  while (true) {
    const { data, error } = await listPage(offset, pageSize)
    if (error) throw error
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

export function totalBytes(files) {
  return files.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
}

export function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)}MB`
  return `${(mb / 1024).toFixed(2)}GB`
}

export function usagePercent(bytes, limitGB) {
  const limitBytes = limitGB * 1024 * 1024 * 1024
  return Math.round((bytes / limitBytes) * 1000) / 10
}

export function topLargestFiles(files, limit = 10) {
  return [...files]
    .map(f => ({ name: f.name, size: f.metadata?.size ?? 0 }))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
}
