import { readKept, watchKept, writeKept } from './keep.ts'

const MOI = 'mm-simple-v1'
const NOURAN = 'mm-nouran-v1'

export type CloudState = {
  moi: unknown[]
  nouran: { opening: number; moves: unknown[] }
}

function isEmpty(state: CloudState) {
  return state.moi.length === 0 && state.nouran.opening === 0 && state.nouran.moves.length === 0
}

export function readLocalState(): CloudState {
  const moiRaw = readKept(MOI)
  const nouranRaw = readKept(NOURAN)
  let moi: unknown[] = []
  let nouran = { opening: 0, moves: [] as unknown[] }
  try {
    if (moiRaw) {
      const parsed = JSON.parse(moiRaw) as unknown
      if (Array.isArray(parsed)) moi = parsed
    }
  } catch {
    moi = []
  }
  try {
    if (nouranRaw) {
      const parsed = JSON.parse(nouranRaw) as { opening?: unknown; moves?: unknown }
      if (typeof parsed.opening === 'number' && Array.isArray(parsed.moves)) {
        nouran = { opening: parsed.opening, moves: parsed.moves }
      }
    }
  } catch {
    nouran = { opening: 0, moves: [] }
  }
  return { moi, nouran }
}

function writeLocal(state: CloudState) {
  writeKept(MOI, JSON.stringify(state.moi), { silent: true })
  writeKept(NOURAN, JSON.stringify(state.nouran), { silent: true })
}

async function readJson(response: Response) {
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) return null
  return response.json() as Promise<CloudState>
}

export async function loginOnline(password: string, remember: boolean) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, remember }),
    })
    const type = response.headers.get('content-type') || ''
    if (!type.includes('application/json')) return 'offline' as const
    if (response.status === 503) return 'offline' as const
    if (!response.ok) return 'bad' as const
    return 'ok' as const
  } catch {
    return 'offline' as const
  }
}

export async function syncAfterLogin() {
  try {
    const response = await fetch('/api/state', { credentials: 'include' })
    const remote = await readJson(response)
    if (!response.ok || !remote) return
    const local = readLocalState()
    if (isEmpty(remote) && !isEmpty(local)) {
      await fetch('/api/state', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(local),
      })
      return
    }
    if (!isEmpty(remote)) writeLocal(remote)
  } catch {
    return
  }
}

async function pushState() {
  try {
    await fetch('/api/state', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(readLocalState()),
    })
  } catch {
    return
  }
}

let started = false
let timer = 0

export function startSync() {
  if (started) return
  started = true
  watchKept(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => { void pushState() }, 600)
  })
}

export async function saveCopyFile() {
  const file = new File([JSON.stringify(readLocalState())], 'moneymoney.json', { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Moneymoney' })
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = 'moneymoney.json'
  link.click()
  URL.revokeObjectURL(url)
}

export async function loadCopyFile(file: File) {
  const parsed = JSON.parse(await file.text()) as CloudState
  if (!parsed || !Array.isArray(parsed.moi) || !parsed.nouran || !Array.isArray(parsed.nouran.moves) || typeof parsed.nouran.opening !== 'number') {
    throw new Error('bad file')
  }
  writeLocal(parsed)
  await pushState()
}
