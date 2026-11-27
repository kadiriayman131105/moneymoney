const PIN_KEY = 'mm-pin'
const UNLOCK_KEY = 'mm-unlocked'

export function hasPin() {
  return Boolean(localStorage.getItem(PIN_KEY))
}

export function isSessionUnlocked() {
  return sessionStorage.getItem(UNLOCK_KEY) === '1'
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, '1')
}

export function clearUnlock() {
  sessionStorage.removeItem(UNLOCK_KEY)
}

export async function hashPin(pin: string) {
  const data = new TextEncoder().encode(`moneymoney:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function savePin(pin: string) {
  localStorage.setItem(PIN_KEY, await hashPin(pin))
  markUnlocked()
}

export function removePin() {
  localStorage.removeItem(PIN_KEY)
  clearUnlock()
}

export async function pinMatches(pin: string) {
  const saved = localStorage.getItem(PIN_KEY)
  if (!saved) return false
  return (await hashPin(pin)) === saved
}
