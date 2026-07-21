import { useSectionContent } from '../hooks/useSectionContent'

export default function HeroSection() {
  const { data, loading } = useSectionContent('hero')

  if (loading || !data) {
    return <section id="hero" className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e]" />
  }

  const { photo, label, name, subtitle, quote, facts } = data

  return (
    <section
      id="hero"
      className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e] flex items-center justify-center text-white text-center px-6 relative overflow-hidden"
    >
      <img
        src={photo}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover object-top md:object-center opacity-40 [@media(min-aspect-ratio:3/2)]:object-contain [@media(max-aspect-ratio:3/4)]:object-contain"
        onError={e => { e.target.style.display = 'none' }}
      />
      <div className="relative flex flex-col items-center gap-4 max-w-2xl">
        <p className="text-xs tracking-[4px] text-gray-400 uppercase">{label}</p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">{name}</h1>
        <p className="text-gray-300 text-base">{subtitle}</p>
        <p className="text-gray-400 text-sm leading-relaxed mt-2 whitespace-pre-line">{quote}</p>
        <dl className="flex flex-col gap-1 mt-6 text-sm text-gray-300">
          {facts.map((fact, i) => (
            <div key={i} className="flex gap-2 justify-center">
              <dt className="text-gray-500">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
