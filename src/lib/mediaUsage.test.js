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

  it('URL 인코딩된 경로(공백 등)를 디코딩해서 반환한다 (스토리지의 실제 파일명과 일치시키기 위함)', () => {
    const data = {
      hero: {
        photo: 'https://x.supabase.co/storage/v1/object/public/media/1784637595016-title_1%20copy.jpg',
      },
    }
    expect(extractMediaPaths(data)).toEqual(['1784637595016-title_1 copy.jpg'])
  })

  it('잘못된 percent-encoding이 있어도 에러 없이 원본 문자열을 반환한다', () => {
    const data = {
      broken: 'https://x.supabase.co/storage/v1/object/public/media/broken%file.jpg',
    }
    expect(extractMediaPaths(data)).toEqual(['broken%file.jpg'])
  })
})
