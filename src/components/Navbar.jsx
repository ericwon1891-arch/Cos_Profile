import { useState, useEffect } from 'react'
import { Link } from 'react-scroll'

const NAV_LINKS = [
  { label: '소개', to: 'about' },
  { label: '작업물', to: 'works' },
  { label: '연락처', to: 'footer' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${
      scrolled ? 'bg-black/80 backdrop-blur-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link
          to="hero"
          smooth
          duration={500}
          className="text-white font-bold text-lg cursor-pointer"
        >
          채수지
        </Link>
        <div className="flex gap-6">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              smooth
              duration={500}
              offset={-70}
              className="text-white/80 hover:text-white cursor-pointer text-sm transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
