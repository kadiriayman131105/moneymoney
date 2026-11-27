import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from './components/ui.tsx'
import { isGateOpen, openGate, passwordMatches } from './gate.ts'
import { loginOnline, startSync, syncAfterLogin } from './lib/remote.ts'

export function PasswordGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(isGateOpen)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(isGateOpen)

  useEffect(() => {
    if (!open) return
    let live = true
    startSync()
    void syncAfterLogin().finally(() => {
      if (live) setBooting(false)
    })
    return () => { live = false }
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const online = await loginOnline(password, remember)
    if (online === 'bad') {
      setBusy(false)
      setError('Mauvais mot de passe.')
      return
    }
    if (online === 'offline') {
      const ok = await passwordMatches(password)
      setBusy(false)
      if (!ok) {
        setError('Mauvais mot de passe.')
        return
      }
    } else {
      setBusy(false)
    }
    openGate(remember)
    setBooting(true)
    setOpen(true)
  }

  if (!open) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <form className="w-full max-w-sm rounded-lg bg-elev px-5 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" onSubmit={submit}>
          <h1 className="text-xl font-bold">Mot de passe</h1>
          <p className="mt-1 mb-4 text-sm text-muted">Cette page s’ouvre seulement pour toi.</p>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Mot de passe</span>
            <input
              className="w-full rounded-lg border border-line bg-soft px-3 py-2.5 outline-none focus:border-gold"
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="mb-3 text-sm font-semibold text-bad">{error}</p>}
          <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Se souvenir de moi
          </label>
          <Button type="submit" className="w-full" disabled={busy || password.length === 0}>Entrer</Button>
        </form>
      </div>
    )
  }

  if (booting) return <div className="grid min-h-dvh place-items-center text-sm text-muted">Chargement</div>
  return children
}
