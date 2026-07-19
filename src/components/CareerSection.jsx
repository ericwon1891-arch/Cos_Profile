import { useSectionContent } from '../hooks/useSectionContent'

export default function CareerSection() {
  const { data, loading } = useSectionContent('career')

  if (loading || !data) {
    return <section id="career" className="py-20 bg-[#f9f9f7]" />
  }

  const { heading, years } = data

  return (
    <section id="career" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <div className="space-y-10">
          {years.map(({ year, entries }) => (
            <div key={year} className="grid grid-cols-[80px_1fr] gap-4">
              <p className="text-xl font-bold text-gray-900">{year}</p>
              <ul className="space-y-3">
                {entries.map((entry, i) => (
                  <li key={i} className="flex justify-between text-sm border-b border-gray-200 pb-2">
                    <span className="text-gray-800 font-medium">{entry.event}</span>
                    <span className="text-gray-500">{entry.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
