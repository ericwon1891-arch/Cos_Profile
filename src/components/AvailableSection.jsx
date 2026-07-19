import { useSectionContent } from '../hooks/useSectionContent'

export default function AvailableSection() {
  const { data, loading } = useSectionContent('available')

  if (loading || !data) {
    return <section id="available" className="py-20 bg-[#0d0d0d]" />
  }

  const { heading, tags } = data

  return (
    <section id="available" className="py-20 bg-[#0d0d0d] text-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12">{heading}</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {tags.map(tag => (
            <span key={tag} className="border border-gray-600 rounded-full px-4 py-2 text-sm text-gray-200">
              ✔ {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
