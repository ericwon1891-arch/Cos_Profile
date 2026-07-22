import { render, screen, fireEvent } from '@testing-library/react'
import AccountForm from '../admin/sections/AccountForm'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

function fillForm({ current = 'old-pw', next = 'new-pw123', confirm = 'new-pw123' } = {}) {
  fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: confirm } })
}

describe('AccountForm', () => {
  it('새 비밀번호가 6자 미만이면 검증 에러를 표시하고 changePassword를 호출하지 않는다', () => {
    const changePassword = vi.fn()
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm({ next: '123', confirm: '123' })
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(screen.getByText('비밀번호는 6자 이상이어야 합니다.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('새 비밀번호와 확인값이 다르면 검증 에러를 표시한다', () => {
    const changePassword = vi.fn()
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm({ next: 'new-pw123', confirm: 'different' })
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(screen.getByText('새 비밀번호가 일치하지 않습니다.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('제출 성공 시 성공 메시지를 표시하고 필드를 초기화한다', async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: null })
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(await screen.findByText('비밀번호가 변경되었습니다.')).toBeInTheDocument()
    expect(changePassword).toHaveBeenCalledWith('old-pw', 'new-pw123')
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue('')
  })

  it('현재 비밀번호가 틀리면 에러 메시지를 표시하고 필드를 유지한다', async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: { step: 'reauth', message: 'Invalid login credentials' } })
    useAuth.mockReturnValue({ changePassword })

    render(<AccountForm />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(await screen.findByText('현재 비밀번호가 올바르지 않습니다.')).toBeInTheDocument()
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('new-pw123')
  })
})
