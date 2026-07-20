import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useSectionContent } from '../../hooks/useSectionContent'
import HeroForm from './sections/HeroForm'
import AboutForm from './sections/AboutForm'
import StrengthForm from './sections/StrengthForm'
import CareerForm from './sections/CareerForm'
import CharactersForm from './sections/CharactersForm'
import AvailableForm from './sections/AvailableForm'
import SnsForm from './sections/SnsForm'
import ServicesForm from './sections/ServicesForm'
import PersonalityForm from './sections/PersonalityForm'
import ContactForm from './sections/ContactForm'

const SECTIONS = [
  { key: 'hero', label: 'Hero', Form: HeroForm },
  { key: 'about', label: 'About Me', Form: AboutForm },
  { key: 'strength', label: 'Strength', Form: StrengthForm },
  { key: 'career', label: 'Career', Form: CareerForm },
  { key: 'characters', label: '대표 캐릭터', Form: CharactersForm },
  { key: 'available', label: 'Available', Form: AvailableForm },
  { key: 'sns', label: 'SNS', Form: SnsForm },
  { key: 'services', label: 'Additional Services', Form: ServicesForm },
  { key: 'personality', label: 'Personality', Form: PersonalityForm },
  { key: 'contact', label: 'Contact', Form: ContactForm },
]

export default function AdminDashboard() {
  const { signOut } = useAuth()
  const [activeKey, setActiveKey] = useState(SECTIONS[0].key)
  const { data, loading } = useSectionContent(activeKey)
  const [status, setStatus] = useState(null)

  async function handleSave(newData) {
    setStatus({ type: 'pending', message: '저장 중...' })
    const { error } = await supabase
      .from('site_content')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('section', activeKey)

    if (error) {
      setStatus({ type: 'error', message: `저장 실패: ${error.message}` })
      return
    }
    setStatus({ type: 'success', message: '저장되었습니다.' })
    setTimeout(() => setStatus(null), 3000)
  }

  const active = SECTIONS.find(s => s.key === activeKey)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold">포트폴리오 관리자</h1>
        <button onClick={signOut} className="text-sm text-gray-500 hover:underline">로그아웃</button>
      </header>
      {status && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-sm text-white ${
            status.type === 'error' ? 'bg-red-600' : status.type === 'success' ? 'bg-green-600' : 'bg-gray-700'
          }`}
        >
          {status.message}
        </div>
      )}
      <div className="flex">
        <nav className="w-48 bg-white border-r min-h-[calc(100vh-57px)] p-4">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveKey(s.key)}
              className={`block w-full text-left px-3 py-2 rounded text-sm mb-1 ${
                activeKey === s.key ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <main className="flex-1 p-8 max-w-2xl">
          {!loading && data && active && (
            <active.Form data={data} onSave={handleSave} />
          )}
          {!loading && !data && (
            <p className="text-gray-500 text-sm">이 섹션의 데이터가 없습니다. supabase/seed.sql을 실행했는지 확인해 주세요.</p>
          )}
        </main>
      </div>
    </div>
  )
}
