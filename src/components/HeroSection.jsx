import { useState } from 'react'
import { Link } from 'react-scroll'
import VideoModal from './VideoModal'

const SHOWREEL = {
  id: 0,
  title: '쇼릴',
  type: 'youtube',
  youtubeId: 'REPLACE_WITH_SHOWREEL_ID',
}

export default function HeroSection() {
  const [showReel, setShowReel] = useState(false)

  return (
    <section
      id="hero"
      className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e] flex items-center justify-center text-white text-center px-6"
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs tracking-[4px] text-gray-400 uppercase">Video Editor</p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">채 수 지</h1>
        <p className="text-gray-400 text-base max-w-xs leading-relaxed mt-2">
          유튜브 · SNS · 광고 영상 편집<br />
          Premiere Pro · After Effects
        </p>
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => setShowReel(true)}
            className="border border-white px-6 py-2.5 text-sm hover:bg-white hover:text-black transition-colors"
          >
            ▶ 쇼릴 재생
          </button>
          <Link
            to="works"
            smooth
            duration={500}
            className="bg-white text-black px-6 py-2.5 text-sm cursor-pointer hover:bg-gray-200 transition-colors"
          >
            작업물 보기
          </Link>
        </div>
      </div>
      {showReel && <VideoModal work={SHOWREEL} onClose={() => setShowReel(false)} />}
    </section>
  )
}
