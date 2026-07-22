import { useState } from 'react'
import PasswordField from '../fields/PasswordField'
import { useAuth } from '../../../hooks/useAuth'

export default function AccountForm() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: '비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: '새 비밀번호가 일치하지 않습니다.' })
      return
    }

    setStatus({ type: 'pending', message: '변경 중...' })
    const { error } = await changePassword(currentPassword, newPassword)

    if (error?.step === 'reauth') {
      setStatus({ type: 'error', message: '현재 비밀번호가 올바르지 않습니다.' })
      return
    }
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({ type: 'success', message: '비밀번호가 변경되었습니다.' })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <PasswordField label="현재 비밀번호" value={currentPassword} onChange={setCurrentPassword} />
      <PasswordField label="새 비밀번호" value={newPassword} onChange={setNewPassword} />
      <PasswordField label="새 비밀번호 확인" value={confirmPassword} onChange={setConfirmPassword} />
      {status && (
        <p
          className={`text-sm mb-4 ${
            status.type === 'error' ? 'text-red-500' : status.type === 'success' ? 'text-green-600' : 'text-gray-500'
          }`}
        >
          {status.message}
        </p>
      )}
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">
        변경
      </button>
    </form>
  )
}
