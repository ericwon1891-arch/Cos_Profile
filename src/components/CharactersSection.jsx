import { useState } from 'react'
import { useSectionContent } from '../hooks/useSectionContent'
import WorkCard from './WorkCard'
import VideoModal from './VideoModal'
import PhotoModal from './PhotoModal'

export default function CharactersSection() {
  const { data, loading } = useSectionContent('characters')
  const [activeFilter, setActiveFilter] = useState('전체')
  const [selectedWork, setSelectedWork] = useState(null)

  if (loading || !data) {
    return <section id="characters" className="py-20 bg-[#f9f9f7]" />
  }

  const { heading, categories, items } = data
  const filtered = activeFilter === '전체'
    ? items
    : items.filter(item => item.category === activeFilter)

  return (
    <section id="characters" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <div className="flex gap-3 justify-center mb-10 flex-wrap">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveFilter(category)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeFilter === category
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(item => (
            <WorkCard key={item.id} work={item} onClick={setSelectedWork} />
          ))}
        </div>
      </div>
      {selectedWork && selectedWork.type === 'photo' && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
      {selectedWork && selectedWork.type !== 'photo' && (
        <VideoModal work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
    </section>
  )
}
