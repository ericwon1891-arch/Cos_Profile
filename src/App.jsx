import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import AboutSection from './components/AboutSection'
import StrengthSection from './components/StrengthSection'
import CareerSection from './components/CareerSection'
import CharactersSection from './components/CharactersSection'
import AvailableSection from './components/AvailableSection'
import SnsSection from './components/SnsSection'
import ServicesSection from './components/ServicesSection'
import PersonalitySection from './components/PersonalitySection'
import ContactSection from './components/ContactSection'
import AdminLogin from './components/admin/AdminLogin'
import AdminDashboard from './components/admin/AdminDashboard'
import RequireAuth from './components/admin/RequireAuth'

function PublicSite() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <AboutSection />
      <StrengthSection />
      <CareerSection />
      <CharactersSection />
      <AvailableSection />
      <SnsSection />
      <ServicesSection />
      <PersonalitySection />
      <ContactSection />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboard />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
