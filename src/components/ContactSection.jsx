import { useSectionContent } from '../hooks/useSectionContent'

export default function ContactSection() {
  const { data, loading } = useSectionContent('contact')

  if (loading || !data) {
    return <footer id="contact" className="bg-[#0d0d0d] py-16" />
  }

  const { qrImage, links } = data

  return (
    <footer id="contact" className="bg-[#0d0d0d] text-white py-16 text-center">
      <div className="max-w-xl mx-auto px-6">
        <h2 className="text-2xl font-bold mb-2">Contact</h2>
        <img
          src={qrImage}
          alt="Contact QR 코드"
          className="w-32 h-32 mx-auto my-6 bg-white rounded-lg p-2"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="flex justify-center gap-8 flex-wrap">
          {links.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white text-sm transition-colors border-b border-gray-600 pb-0.5"
            >
              {label}
            </a>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-12">© 2026 NANARY. All rights reserved.</p>
      </div>
    </footer>
  )
}
