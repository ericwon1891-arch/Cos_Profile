export function buildUploadPath(fileName, timestamp = Date.now()) {
  const lastDot = fileName.lastIndexOf('.')
  const ext = lastDot === -1 ? 'jpg' : fileName.slice(lastDot + 1).toLowerCase()
  return `${timestamp}.${ext}`
}
