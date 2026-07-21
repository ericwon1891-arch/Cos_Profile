import { useState, useEffect } from 'react'
import { Link } from 'react-scroll'
import { useSectionContent } from '../hooks/useSectionContent'

const LINKS_BEFORE_CHARACTERS = [
  { label: '소개', to: 'about' },
  { label: '경력', to: 'career' },
]

const LINKS_AFTER_CHARACTERS = [
  { label: 'Contact', to: 'contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { data, loading } = useSectionContent('characters')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const characterLinks = (!loading && data?.sections)
    ? data.sections.map(section => ({ label: section.heading, to: `characters-${section.id}` }))
    : []

  const navLinks = [...LINKS_BEFORE_CHARACTERS, ...characterLinks, ...LINKS_AFTER_CHARACTERS]

  function closeMenu() {
    setMenuOpen(false)
  }

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
          NANARY
        </Link>
        <div data-testid="desktop-nav" className="hidden md:flex gap-6">
          {navLinks.map(({ label, to }) => (
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
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className="md:hidden text-white w-8 h-8 flex flex-col items-center justify-center gap-1.5"
          aria-label="메뉴 열기"
        >
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
          <span className="block w-6 h-0.5 bg-white" />
        </button>
      </div>
      {menuOpen && (
        <div
          data-testid="mobile-nav-panel"
          className="md:hidden bg-black/90 backdrop-blur-sm flex flex-col items-center gap-4 py-6"
        >
          {navLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              smooth
              duration={500}
              offset={-70}
              onClick={closeMenu}
              className="text-white/80 hover:text-white cursor-pointer text-sm transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
