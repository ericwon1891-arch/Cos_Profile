const TOOLS = ['Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Photoshop']

const STATS = [
  { value: '3년+', label: '편집 경력' },
  { value: '50+', label: '프로젝트' },
]

export default function AboutSection() {
  return (
    <section id="about" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">소개</h2>
        <div className="grid md:grid-cols-[200px_1fr] gap-12 items-start">
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gray-300 overflow-hidden">
              <img
                src="/profile.jpg"
                alt="프로필 사진"
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {TOOLS.map(tool => (
                <span key={tool} className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                  {tool}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs tracking-widest text-gray-400 mb-3">ABOUT ME</p>
            <p className="text-gray-700 leading-relaxed mb-6">
              영상 편집의 힘을 믿습니다. 유튜브 채널 운영부터 브랜드 광고까지,<br />
              이야기가 담긴 영상으로 시청자와 연결합니다.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              {STATS.map(({ value, label }) => (
                <div key={label} className="bg-white border border-gray-200 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
