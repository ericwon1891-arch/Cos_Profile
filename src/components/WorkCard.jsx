export default function WorkCard({ work, onClick }) {
  const isPhoto = work.type === 'photo'

  return (
    <div
      className="group cursor-pointer"
      data-testid="work-card"
      onClick={() => onClick(work)}
    >
      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden relative">
        <img
          src={work.thumbnail}
          alt={work.title}
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          {isPhoto ? (
            <div data-testid="photo-icon" className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white rounded-sm" />
            </div>
          ) : (
            <div data-testid="play-icon" className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-gray-800">{work.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{work.category}</p>
      </div>
    </div>
  )
}
