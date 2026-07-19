import { useSectionContent } from '../hooks/useSectionContent'

export default function SnsSection() {
  const { data, loading } = useSectionContent('sns')

  if (loading || !data) {
    return <section id="sns" className="py-20 bg-[#f9f9f7]" />
  }

  const { heading, platforms } = data

  return (
    <section id="sns" className="py-20 bg-[#f9f9f7]">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {platforms.map(platform => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-gray-400 transition-colors"
            >
              <p className="font-bold text-gray-900 mb-3">{platform.name}</p>
              {platform.stats.map((stat, i) => (
                <p key={i} className="text-sm text-gray-600">
                  {stat.label} <span className="font-semibold text-gray-900">{stat.value}</span>
                </p>
              ))}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
