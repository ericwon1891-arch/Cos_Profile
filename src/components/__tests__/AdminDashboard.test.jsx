import { render, screen, fireEvent } from '@testing-library/react'
import AdminDashboard from '../admin/AdminDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useSectionContent } from '../../hooks/useSectionContent'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../../hooks/useSectionContent', () => ({
  useSectionContent: vi.fn(),
}))
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

const heroData = { photo: '', label: '', name: '', subtitle: '', quote: '', facts: [] }

describe('AdminDashboard', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ signOut: vi.fn() })
    useSectionContent.mockReturnValue({ data: heroData, loading: false })
  })

  it('저장 성공 시 화면에 고정된 성공 메시지를 표시한다', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) })

    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('저장되었습니다.')
    expect(toast.className).toContain('fixed')
  })

  it('저장 실패 시 실패 사유를 포함한 메시지를 표시한다', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: '권한 없음' } })
    supabase.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) })

    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('저장 실패: 권한 없음')
  })

  it('계정 설정 메뉴를 클릭하면 비밀번호 변경 폼을 보여준다', () => {
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: '계정 설정' }))

    expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
  })
})
