export default function PhotoModal({ work, onClose }) {
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
          src={work.src}
          alt={work.title}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
      </div>
    </div>
  )
}
