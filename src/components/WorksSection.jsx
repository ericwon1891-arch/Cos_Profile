import { useState } from 'react'
import { works } from '../data/works'
import WorkCard from './WorkCard'
import VideoModal from './VideoModal'

const FILTERS = ['전체', '유튜브/SNS', '광고/홍보']

export default function WorksSection() {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [selectedWork, setSelectedWork] = useState(null)

  const filtered = activeFilter === '전체'
    ? works
    : works.filter(w => w.category === activeFilter)

  return (
    <section id="works" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">작업물</h2>
        <div className="flex gap-3 justify-center mb-10">
          {FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(work => (
            <WorkCard key={work.id} work={work} onClick={setSelectedWork} />
          ))}
        </div>
      </div>
      {selectedWork && (
        <VideoModal work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
    </section>
  )
}
