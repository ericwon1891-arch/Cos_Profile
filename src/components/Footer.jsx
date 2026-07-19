const LINKS = [
  { label: '이메일', href: 'mailto:soozy48@naver.com' },
  { label: '인스타그램', href: 'https://instagram.com/your_handle' },
  { label: '유튜브', href: 'https://youtube.com/@your_channel' },
]

export default function Footer() {
  return (
    <footer id="footer" className="bg-[#0d0d0d] text-white py-16 text-center">
      <div className="max-w-xl mx-auto px-6">
        <h2 className="text-2xl font-bold mb-2">연락하기</h2>
        <p className="text-gray-400 text-sm mb-8">
          프로젝트 문의나 협업 제안은 언제든지 환영합니다.
        </p>
        <div className="flex justify-center gap-8 flex-wrap">
          {LINKS.map(({ label, href }) => (
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
        <p className="text-gray-600 text-xs mt-12">© 2026 채수지. All rights reserved.</p>
      </div>
    </footer>
  )
}
