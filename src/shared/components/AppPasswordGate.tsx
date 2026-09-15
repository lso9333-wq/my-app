import { useState, type FormEvent } from 'react'
import { login } from '../lib/authApi'

interface Props {
  onUnlock: (token: string) => void
}

/**
 * 보행/ROM/손발/XMSK 4개 탭 전체를 가리는 공용 잠금 화면.
 *
 * xmsk/components/XmskPasswordGate.tsx를 일반화한 것 — 2026-09 보안 점검 이후
 * 비밀번호 보호가 XMSK 하나에서 4개 탭 전체로 확대되면서, App.tsx가 최상위에서
 * 토큰을 하나로 관리하고 이 컴포넌트를 공용으로 쓴다. XmskPasswordGate.tsx는 더는
 * 쓰이지 않지만, 예전 방식 참고용으로 파일은 남겨뒀다.
 */
export function AppPasswordGate({ onUnlock }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token = await login(password)
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
      <p className="xmsk-gate-title">트레이너 전용 도구입니다</p>
      <p className="app-subtitle">비밀번호를 입력하면 보행·ROM·손발·XMSK 분석 도구를 사용할 수 있습니다.</p>
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
