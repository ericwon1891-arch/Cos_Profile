import {
  fetchAllStorageFiles,
  totalBytes,
  formatBytes,
  usagePercent,
  topLargestFiles,
  isFolderPlaceholder,
  stripTrashPrefix,
  daysUntilExpiry,
  isExpired,
  describeStorageActionError,
} from './storageUsage'

describe('fetchAllStorageFiles', () => {
  it('전체 결과가 페이지 크기보다 작으면 한 번만 호출한다', async () => {
    const listPage = vi.fn().mockResolvedValue({ data: [{ name: 'a' }], error: null })
    const files = await fetchAllStorageFiles(listPage, 10)
    expect(files).toEqual([{ name: 'a' }])
    expect(listPage).toHaveBeenCalledTimes(1)
    expect(listPage).toHaveBeenCalledWith(0, 10)
  })

  it('결과가 페이지 크기와 같으면 다음 페이지를 이어서 조회한다', async () => {
    const listPage = vi.fn()
      .mockResolvedValueOnce({ data: [{ name: 'a' }, { name: 'b' }], error: null })
      .mockResolvedValueOnce({ data: [{ name: 'c' }], error: null })
    const files = await fetchAllStorageFiles(listPage, 2)
    expect(files.map(f => f.name)).toEqual(['a', 'b', 'c'])
    expect(listPage).toHaveBeenCalledTimes(2)
    expect(listPage).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('에러가 있으면 던진다', async () => {
    const listPage = vi.fn().mockResolvedValue({ data: null, error: { message: '실패' } })
    await expect(fetchAllStorageFiles(listPage, 10)).rejects.toEqual({ message: '실패' })
  })
})

describe('totalBytes', () => {
  it('모든 파일의 metadata.size 합을 반환한다', () => {
    expect(totalBytes([{ metadata: { size: 100 } }, { metadata: { size: 200 } }])).toBe(300)
  })

  it('metadata가 없으면 0으로 취급한다', () => {
    expect(totalBytes([{ metadata: { size: 100 } }, {}])).toBe(100)
  })
})

describe('formatBytes', () => {
  it('1GB 미만이면 MB로 표시한다', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB')
  })

  it('1GB 이상이면 GB로 표시한다', () => {
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50GB')
  })
})

describe('usagePercent', () => {
  it('한도 대비 사용률을 소수 첫째 자리까지 반환한다', () => {
    expect(usagePercent(0.005 * 1024 * 1024 * 1024, 1)).toBe(0.5)
  })
})

describe('topLargestFiles', () => {
  it('크기 내림차순으로 상위 N개를 반환한다', () => {
    const files = [
      { name: 'a', metadata: { size: 10 } },
      { name: 'b', metadata: { size: 30 } },
      { name: 'c', metadata: { size: 20 } },
    ]
    expect(topLargestFiles(files, 2)).toEqual([
      { name: 'b', size: 30 },
      { name: 'c', size: 20 },
    ])
  })
})

describe('isFolderPlaceholder', () => {
  it('id가 null이면 폴더 플레이스홀더로 판별한다', () => {
    expect(isFolderPlaceholder({ id: null, name: 'trash' })).toBe(true)
  })

  it('id가 있으면 폴더 플레이스홀더가 아니다', () => {
    expect(isFolderPlaceholder({ id: 'abc', name: 'a.jpg' })).toBe(false)
  })
})

describe('stripTrashPrefix', () => {
  it('trash/ 접두사를 제거한다', () => {
    expect(stripTrashPrefix('trash/1700000000000.jpg')).toBe('1700000000000.jpg')
  })

  it('trash/ 접두사가 없으면 그대로 반환한다', () => {
    expect(stripTrashPrefix('1700000000000.jpg')).toBe('1700000000000.jpg')
  })
})

describe('daysUntilExpiry', () => {
  it('13일 지났으면 1일 남았다고 계산한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(1)
  })

  it('정확히 14일 지났으면 0을 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(0)
  })

  it('15일 지났으면 음수를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntilExpiry(updatedAt, now)).toBe(-1)
  })
})

describe('isExpired', () => {
  it('daysUntilExpiry가 0 이하면 true를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
    expect(isExpired(updatedAt, now)).toBe(true)
  })

  it('daysUntilExpiry가 양수면 false를 반환한다', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const updatedAt = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString()
    expect(isExpired(updatedAt, now)).toBe(false)
  })
})

describe('describeStorageActionError', () => {
  it('row-level security 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(
      describeStorageActionError({ message: 'new row violates row-level security policy' })
    ).toBe('로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.')
  })

  it('네트워크 관련 메시지면 인터넷 연결 안내를 반환한다', () => {
    expect(describeStorageActionError({ message: 'Failed to fetch' })).toBe(
      '인터넷 연결을 확인해 주세요.'
    )
  })

  it('분류되지 않는 에러는 관리자 문의 안내와 원본 메시지를 함께 반환한다', () => {
    expect(describeStorageActionError({ message: '알 수 없는 서버 오류' })).toBe(
      '문제가 계속되면 관리자에게 문의해 주세요. (알 수 없는 서버 오류)'
    )
  })
})
