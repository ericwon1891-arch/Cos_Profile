import { fetchAllStorageFiles, totalBytes, formatBytes, usagePercent, topLargestFiles } from './storageUsage'

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
