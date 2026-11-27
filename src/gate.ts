const SALT = 'd51f0ed92c26d761305f09c737876878'
const HASH = 'b8f32bb14d36150600606812e6344ad55868f5e44082debc90558c267980f43c'
const ITERATIONS = 120_000
const SESSION = 'mm-gate'
const REMEMBER = 'mm-gate-keep'

function bytesFromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function sameHex(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

export function isGateOpen() {
  return localStorage.getItem(REMEMBER) === '1' || sessionStorage.getItem(SESSION) === '1'
}

export function openGate(remember: boolean) {
  if (remember) localStorage.setItem(REMEMBER, '1')
  else localStorage.removeItem(REMEMBER)
  sessionStorage.setItem(SESSION, '1')
}

export async function passwordMatches(password: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytesFromHex(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  const hex = [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return sameHex(hex, HASH)
}
