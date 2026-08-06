function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function extractMediaPaths(data) {
  const text = JSON.stringify(data ?? {})
  const matches = text.matchAll(/\/storage\/v1\/object\/public\/media\/([^"\\]+)/g)
  return [...matches].map(m => safeDecodeURIComponent(m[1]))
}
