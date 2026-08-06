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

export const TRASH_PREFIX = 'trash/'
export const TRASH_RETENTION_DAYS = 14

export function isFolderPlaceholder(file) {
  return file.id === null
}

export function stripTrashPrefix(name) {
  return name.startsWith(TRASH_PREFIX) ? name.slice(TRASH_PREFIX.length) : name
}

export function daysUntilExpiry(updatedAt, now = Date.now()) {
  const elapsedMs = now - new Date(updatedAt).getTime()
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
  return TRASH_RETENTION_DAYS - elapsedDays
}

export function isExpired(updatedAt, now = Date.now()) {
  return daysUntilExpiry(updatedAt, now) <= 0
}

// 목록의 40px 썸네일에 원본 이미지(수 MB) 전체를 내려받지 않도록 Supabase 이미지
// 변환 API로 80px(2x 대응) 리사이즈본을 요청한다. 목록 스크롤 버벅임의 원인이었음.
export const THUMBNAIL_TRANSFORM = { width: 80, height: 80, resize: 'cover' }

export function describeStorageActionError(error) {
  if (/row-level security|not authorized|unauthorized/i.test(error.message)) {
    return '로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
  }
  if (/network|failed to fetch/i.test(error.message)) {
    return '인터넷 연결을 확인해 주세요.'
  }
  return `문제가 계속되면 관리자에게 문의해 주세요. (${error.message})`
}
