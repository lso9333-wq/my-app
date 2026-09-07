import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.XMSK_SECRET ?? 'foreSTRETCH-xmsk-dev-secret'
const PASSWORD = process.env.XMSK_PASSWORD ?? 'forestretch1'
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function checkPassword(password: string): boolean {
  const given = Buffer.from(password)
  const expected = Buffer.from(PASSWORD)
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export function issueToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })
  const encoded = Buffer.from(payload).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return false
  if (sig !== sign(encoded)) return false
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { exp: number }
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}
