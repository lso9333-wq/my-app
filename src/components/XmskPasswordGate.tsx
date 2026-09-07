import { useState, type FormEvent } from 'react'
import { xmskAuth } from '../lib/xmskApi'

interface Props {
  onUnlock: (token: string) => void
}

export function XmskPasswordGate({ onUnlock }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token } = await xmskAuth(password)
      onUnlock(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '잠금을 해제하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="xmsk-gate">
      <p className="xmsk-gate-icon" aria-hidden>
        🔒
      </p>
      <p className="xmsk-gate-title">XMSK는 트레이너 전용 도구입니다</p>
      <p className="app-subtitle">비밀번호를 입력하면 통증 레시피 가이드를 사용할 수 있습니다.</p>
      <form onSubmit={handleSubmit} className="xmsk-gate-form">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
        />
        <button type="submit" disabled={loading || password.trim() === ''}>
          {loading ? '확인 중...' : '잠금 해제'}
        </button>
      </form>
      {error && <p className="error-panel">{error}</p>}
    </div>
  )
}
