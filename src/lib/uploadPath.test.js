import { buildUploadPath } from './uploadPath'

describe('buildUploadPath', () => {
  it('영문 파일명이면 타임스탬프+확장자로 변환한다', () => {
    expect(buildUploadPath('photo.jpg', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('한글이 포함된 파일명도 확장자만 남기고 안전하게 변환한다', () => {
    expect(buildUploadPath('SIH_0026-편집.jpg', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('확장자가 없으면 jpg로 폴백한다', () => {
    expect(buildUploadPath('photo', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('확장자를 소문자로 정규화한다', () => {
    expect(buildUploadPath('PHOTO.JPG', 1700000000000)).toBe('1700000000000.jpg')
  })

  it('파일명에 점이 여러 개면 마지막 점 기준으로 확장자를 판단한다', () => {
    expect(buildUploadPath('my.photo.jpeg', 1700000000000)).toBe('1700000000000.jpeg')
  })

  it('timestamp를 생략하면 Date.now()를 사용한다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    expect(buildUploadPath('photo.png')).toBe('1234567890.png')
    Date.now.mockRestore()
  })
})
