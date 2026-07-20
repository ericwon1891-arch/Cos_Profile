import { useState } from 'react'

function extractYoutubeId(value) {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed.includes('/') && !trimmed.includes('?')) return trimmed

  try {
    const url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1)
    if (url.searchParams.has('v')) return url.searchParams.get('v')
    const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]
    return trimmed
  } catch {
    return trimmed
  }
}

function buildSlides(work) {
  const galleryPhotos = work.photos?.filter(Boolean) ?? []
  const photos = galleryPhotos.length
    ? galleryPhotos
    : (work.type === 'photo' ? [work.src].filter(Boolean) : [])
  const photoSlides = photos.map(url => ({ kind: 'image', url }))

  const videoSlide = work.youtubeId
    ? { kind: 'youtube', id: extractYoutubeId(work.youtubeId), start: work.youtubeStart }
    : work.localVideoSrc
      ? { kind: 'local', src: work.localVideoSrc }
      : (work.type === 'local' && work.src)
        ? { kind: 'local', src: work.src }
        : null

  return videoSlide ? [...photoSlides, videoSlide] : photoSlides
}

export default function PhotoModal({ work, onClose }) {
  const slides = buildSlides(work)
  const [index, setIndex] = useState(0)
  const hasMultiple = slides.length > 1
  const current = slides[index]

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute -top-10 right-0 text-white text-xl hover:text-gray-300"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
        {current?.kind === 'image' && (
          <img
            src={current.url}
            alt={work.title}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}
        {current?.kind === 'youtube' && (
          <div className="aspect-video">
            <iframe
              title="video-player"
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${current.id}?autoplay=1${current.start ? `&start=${current.start}` : ''}`}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        )}
        {current?.kind === 'local' && (
          <div className="aspect-video">
            <video
              data-testid="local-video"
              className="w-full h-full"
              src={current.src}
              controls
              autoPlay
            />
          </div>
        )}
        {hasMultiple && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="이전"
            >
              ‹
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i + 1)}
              disabled={index === slides.length - 1}
              aria-label="다음"
            >
              ›
            </button>
            <p className="text-center text-white text-sm mt-2">{index + 1} / {slides.length}</p>
          </>
        )}
      </div>
    </div>
  )
}
