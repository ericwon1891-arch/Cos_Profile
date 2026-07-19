import { useSectionContent } from '../hooks/useSectionContent'

export default function AboutSection() {
  const { data, loading } = useSectionContent('about')

  if (loading || !data) {
    return <section id="about" className="py-20 bg-[#f9f9f7]" />
  }

  const { heading, body } = data

  return (
    <section id="about" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{body}</p>
      </div>
    </section>
  )
}
