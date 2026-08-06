import { extractMediaPaths } from './mediaUsage'

describe('extractMediaPaths', () => {
  it('중첩된 객체/배열 안의 media URL을 모두 추출한다', () => {
    const data = {
      hero: { imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000000.jpg' },
      characters: [
        { name: 'A', imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000001.jpg' },
        { name: 'B', imageUrl: 'https://x.supabase.co/storage/v1/object/public/media/1700000000002.jpg' },
      ],
    }
    expect(extractMediaPaths(data)).toEqual([
      '1700000000000.jpg',
      '1700000000001.jpg',
      '1700000000002.jpg',
    ])
  })

  it('media URL이 아닌 문자열은 무시한다', () => {
    const data = { title: '안녕하세요', link: 'https://example.com/about' }
    expect(extractMediaPaths(data)).toEqual([])
  })

  it('data가 null/undefined면 빈 배열을 반환한다', () => {
    expect(extractMediaPaths(null)).toEqual([])
    expect(extractMediaPaths(undefined)).toEqual([])
  })

  it('data가 빈 객체면 빈 배열을 반환한다', () => {
    expect(extractMediaPaths({})).toEqual([])
  })
})
