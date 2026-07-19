import { useSectionContent } from '../hooks/useSectionContent'

export default function PersonalitySection() {
  const { data, loading } = useSectionContent('personality')

  if (loading || !data) {
    return <section id="personality" className="py-20 bg-[#f9f9f7]" />
  }

  const { heading, traits } = data

  return (
    <section id="personality" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <ul className="flex flex-wrap gap-3 justify-center">
          {traits.map((trait, i) => (
            <li key={i} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-full">
              {trait}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
