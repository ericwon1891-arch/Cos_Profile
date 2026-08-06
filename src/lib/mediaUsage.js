export function extractMediaPaths(data) {
  const text = JSON.stringify(data ?? {})
  const matches = text.matchAll(/\/storage\/v1\/object\/public\/media\/([^"\\]+)/g)
  return [...matches].map(m => m[1])
}
