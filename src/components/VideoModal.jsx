export default function VideoModal({ work, onClose }) {
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
        <div className="aspect-video">
          {work.type === 'youtube' ? (
            <iframe
              title="video-player"
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${work.youtubeId}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <video
              data-testid="local-video"
              className="w-full h-full"
              src={work.src}
              controls
              autoPlay
            />
          )}
        </div>
      </div>
    </div>
  )
}
