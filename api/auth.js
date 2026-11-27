import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'mm_session'

export function passwordOk(password) {
  const expected = process.env.APP_PASSWORD || ''
  if (!expected || typeof password !== 'string') return false
  const left = createHash('sha256').update(password).digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right)
}

function token(remember) {
  const exp = Date.now() + (remember ? 400 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000)
  const body = String(exp)
  const sig = createHmac('sha256', process.env.APP_PASSWORD).update(body).digest('hex')
  return { value: `${body}.${sig}`, maxAge: remember ? 400 * 24 * 60 * 60 : 12 * 60 * 60 }
}

export function sessionCookie(remember) {
  const next = token(remember)
  return `${COOKIE}=${next.value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${next.maxAge}`
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function readSession(request) {
  const header = request.headers.cookie || ''
  const raw = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
  if (!raw || !process.env.APP_PASSWORD) return false
  const value = decodeURIComponent(raw.slice(COOKIE.length + 1))
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return false
  const body = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = createHmac('sha256', process.env.APP_PASSWORD).update(body).digest('hex')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  const exp = Number(body)
  return Number.isFinite(exp) && exp > Date.now()
}
