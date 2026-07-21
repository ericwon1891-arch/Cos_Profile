import { useState } from 'react'
import WorkCard from './WorkCard'
import PhotoModal from './PhotoModal'

const VISIBLE_COUNT = 6

export default function CharacterSectionBlock({ section }) {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [selectedWork, setSelectedWork] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const { id, heading, categories, items, showMoreEnabled } = section
  const limitEnabled = showMoreEnabled !== false
  const filtered = activeFilter === '전체'
    ? items
    : items.filter(item => item.category === activeFilter)

  const visible = (limitEnabled && !expanded) ? filtered.slice(0, VISIBLE_COUNT) : filtered

  function handleFilterClick(category) {
    setActiveFilter(category)
    setExpanded(false)
  }

  return (
    <section id={`characters-${id}`} className="py-20 bg-[#f9f9f7]">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <div className="flex gap-3 justify-center mb-10 flex-wrap">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => handleFilterClick(category)}
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
          {visible.map(item => (
            <WorkCard key={item.id} work={item} onClick={setSelectedWork} />
          ))}
        </div>
        {limitEnabled && filtered.length > VISIBLE_COUNT && !expanded && (
          <div className="text-center mt-8">
            <button
              onClick={() => setExpanded(true)}
              className="px-6 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:border-gray-500"
            >
              더보기
            </button>
          </div>
        )}
      </div>
      {selectedWork && (
        <PhotoModal key={selectedWork.id} work={selectedWork} onClose={() => setSelectedWork(null)} />
      )}
    </section>
  )
}
