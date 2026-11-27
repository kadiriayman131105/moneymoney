import { useEffect, useState, type ReactNode } from 'react'
import { hasPin, isSessionUnlocked, markUnlocked, pinMatches } from '../lib/pin.ts'
import { PinPad } from './PinPad.tsx'

export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => hasPin() && !isSessionUnlocked())
  const [error, setError] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!shake) return
    const timer = window.setTimeout(() => setShake(false), 350)
    return () => window.clearTimeout(timer)
  }, [shake])

  if (!locked) return children

  async function submit(pin: string) {
    if (await pinMatches(pin)) {
      markUnlocked()
      setLocked(false)
      return
    }
    setError('Code incorrect.')
    setShake(true)
    setResetKey((value) => value + 1)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <p className="num text-center text-4xl text-gold">DH</p>
      <h1 className="mt-3 text-center font-serif text-3xl">Moneymoney</h1>
      <p className="mt-2 text-center text-sm text-muted">Entre ton code pour ouvrir tes chiffres.</p>
      <div className={shake ? 'shake' : undefined}>
        <PinPad resetKey={resetKey} onComplete={(pin) => void submit(pin)} />
      </div>
      {error && <p className="text-center text-sm text-bad">{error}</p>}
    </div>
  )
}
