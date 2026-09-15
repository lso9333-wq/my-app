// 2026-09 보안 점검 이후 더는 쓰이지 않는 파일이다 — XmskApp.tsx가 이제 자기만의
// 잠금 화면을 렌더링하지 않고 App.tsx가 최상위에서 관리하는
// shared/components/AppPasswordGate.tsx(이 컴포넌트를 그대로 일반화한 것)를 쓴다.
// 실제 동작에는 영향이 없지만(아무 데서도 import하지 않음), 예전 XMSK 전용 잠금
// 방식이 어떻게 생겼었는지 참고할 수 있도록 파일은 지우지 않고 남겨둔다.
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
      <p className="app-subtitle">비밀번호를 입력하면 통증 레시피 · 근육 사전 · 평가표를 사용할 수 있습니다.</p>
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
