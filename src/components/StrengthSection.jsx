import { useSectionContent } from '../hooks/useSectionContent'

export default function StrengthSection() {
  const { data, loading } = useSectionContent('strength')

  if (loading || !data) {
    return <section id="strength" className="py-20 bg-[#0d0d0d]" />
  }

  const { heading, items } = data

  return (
    <section id="strength" className="py-20 bg-[#0d0d0d] text-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12">{heading}</h2>
        <ul className="space-y-6">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-gray-300 mt-1">✔</span>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-gray-400 text-sm mt-1">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
