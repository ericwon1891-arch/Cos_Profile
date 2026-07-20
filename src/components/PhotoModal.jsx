import { useState } from 'react'

export default function PhotoModal({ work, onClose }) {
  const galleryPhotos = work.photos?.filter(Boolean) ?? []
  const photos = galleryPhotos.length ? galleryPhotos : [work.src].filter(Boolean)
  const [index, setIndex] = useState(0)
  const hasMultiple = photos.length > 1

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
        <img
          src={photos[index]}
          alt={work.title}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
        {hasMultiple && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="이전 사진"
            >
              ‹
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
              onClick={() => setIndex(i => i + 1)}
              disabled={index === photos.length - 1}
              aria-label="다음 사진"
            >
              ›
            </button>
            <p className="text-center text-white text-sm mt-2">{index + 1} / {photos.length}</p>
          </>
        )}
      </div>
    </div>
  )
}
