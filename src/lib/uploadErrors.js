export function classifyUploadError(error) {
  if (error.statusCode === '413' || /exceeded|too large/i.test(error.message)) {
    return '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
  }
  if (/row-level security|not authorized|unauthorized/i.test(error.message)) {
    return '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
  }
  if (/network|failed to fetch/i.test(error.message)) {
    return '업로드 실패: 인터넷 연결을 확인해 주세요.'
  }
  return `업로드 실패: 문제가 계속되면 관리자에게 문의해 주세요. (${error.message})`
}
