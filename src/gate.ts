const SALT = 'd51f0ed92c26d761305f09c737876878'
const HASH = 'dc94ba7fc63cae28598b913b9bc1cff655531bc6de8ed9f6d946d75eb60b0ba4'
const ITERATIONS = 120_000
const SESSION = 'mm-gate'

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
  return sessionStorage.getItem(SESSION) === '1'
}

export function openGate() {
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
