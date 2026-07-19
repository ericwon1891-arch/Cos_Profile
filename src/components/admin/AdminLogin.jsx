import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

export default function AdminLogin() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)

    setLoading(false)
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6 text-center">관리자 로그인</h1>
        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1">이메일</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
        </label>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
