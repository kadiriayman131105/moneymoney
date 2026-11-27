import { useEffect, useState } from 'react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export function PinPad({ resetKey, onComplete }: { resetKey: number; onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState('')

  useEffect(() => {
    setPin('')
  }, [resetKey])

  function press(key: string) {
    if (key === 'del') {
      setPin((current) => current.slice(0, -1))
      return
    }
    if (!key || pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) onComplete(next)
  }

  return (
    <div className="py-8">
      <div className="mb-8 flex justify-center gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className={index < pin.length ? 'h-3 w-3 rounded-full bg-gold' : 'h-3 w-3 rounded-full bg-line'} />
        ))}
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key) =>
          key === '' ? (
            <span key="gap" />
          ) : (
            <button
              key={key}
              type="button"
              className="grid h-16 place-items-center rounded-full bg-soft text-xl"
              onClick={() => press(key)}
              aria-label={key === 'del' ? 'Effacer' : key}
            >
              {key === 'del' ? '⌫' : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
