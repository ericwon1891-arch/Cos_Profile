import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminLogin from '../admin/AdminLogin'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

describe('AdminLogin', () => {
  it('제출 시 signIn을 이메일/비밀번호와 함께 호출한다', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    useAuth.mockReturnValue({ signIn })

    render(<AdminLogin />)
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('admin@test.com', 'secret'))
  })

  it('로그인 실패 시 에러 메시지를 표시한다', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    useAuth.mockReturnValue({ signIn })

    render(<AdminLogin />)
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument()
  })
})
