import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from '../admin/RequireAuth'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAuth><p>보호된 콘텐츠</p></RequireAuth>} />
        <Route path="/admin/login" element={<p>로그인 페이지</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAuth', () => {
  it('인증되지 않았으면 로그인 페이지로 리다이렉트한다', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false })
    renderWithRouter()
    expect(screen.getByText('로그인 페이지')).toBeInTheDocument()
  })

  it('인증되었으면 children을 렌더링한다', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    renderWithRouter()
    expect(screen.getByText('보호된 콘텐츠')).toBeInTheDocument()
  })

  it('로딩 중이면 아무것도 렌더링하지 않는다', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true })
    const { container } = renderWithRouter()
    expect(container.textContent).toBe('')
  })
})
