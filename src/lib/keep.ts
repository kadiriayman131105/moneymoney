function backupKey(key: string) {
  return `mm-backup:${key}`
}

function canParse(value: string) {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function readKept(key: string) {
  const main = localStorage.getItem(key)
  if (main != null && canParse(main)) return main
  const backup = localStorage.getItem(backupKey(key))
  if (backup != null && canParse(backup)) return backup
  return null
}

let onWrite: (() => void) | null = null

export function watchKept(listener: () => void) {
  onWrite = listener
}

export function writeKept(key: string, value: string, options?: { silent?: boolean }) {
  const current = localStorage.getItem(key)
  if (current && canParse(current)) localStorage.setItem(backupKey(key), current)
  localStorage.setItem(key, value)
  if (!options?.silent) onWrite?.()
}
