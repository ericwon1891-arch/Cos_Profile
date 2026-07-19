import { useSectionContent } from '../hooks/useSectionContent'

export default function ServicesSection() {
  const { data, loading } = useSectionContent('services')

  if (loading || !data) {
    return <section id="services" className="py-20 bg-[#0d0d0d]" />
  }

  const { heading, items } = data

  return (
    <section id="services" className="py-20 bg-[#0d0d0d] text-white">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12">{heading}</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-gray-200">
              <span>✔</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
