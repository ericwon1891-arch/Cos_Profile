import { render, screen, fireEvent } from '@testing-library/react'
import PasswordField from '../admin/fields/PasswordField'

describe('PasswordField', () => {
  it('기본 상태는 비밀번호가 가려져 있다', () => {
    render(<PasswordField label="새 비밀번호" value="secret" onChange={() => {}} />)
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'password')
  })

  it('토글 버튼을 클릭하면 비밀번호가 보이고, 다시 클릭하면 숨겨진다', () => {
    render(<PasswordField label="새 비밀번호" value="secret" onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 표시' }))
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 숨기기' }))
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'password')
  })

  it('입력 변경 시 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<PasswordField label="새 비밀번호" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abc123' } })
    expect(onChange).toHaveBeenCalledWith('abc123')
  })
})
