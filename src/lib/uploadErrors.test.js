import { classifyUploadError } from './uploadErrors'

describe('classifyUploadError', () => {
  it('413 상태코드면 용량 초과 안내를 반환한다', () => {
    expect(classifyUploadError({ statusCode: '413', message: 'Payload too large' })).toBe(
      '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
    )
  })

  it('메시지에 exceeded/too large가 있으면 용량 초과 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'file size exceeded limit' })).toBe(
      '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
    )
  })

  it('row-level security 관련 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(
      classifyUploadError({ message: 'new row violates row-level security policy' })
    ).toBe('업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.')
  })

  it('unauthorized 메시지면 로그인 만료 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'Unauthorized' })).toBe(
      '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
    )
  })

  it('네트워크 관련 메시지면 인터넷 연결 안내를 반환한다', () => {
    expect(classifyUploadError({ message: 'Failed to fetch' })).toBe(
      '업로드 실패: 인터넷 연결을 확인해 주세요.'
    )
  })

  it('분류되지 않는 에러는 관리자 문의 안내와 원본 메시지를 함께 반환한다', () => {
    expect(classifyUploadError({ message: '알 수 없는 서버 오류' })).toBe(
      '업로드 실패: 문제가 계속되면 관리자에게 문의해 주세요. (알 수 없는 서버 오류)'
    )
  })
})
