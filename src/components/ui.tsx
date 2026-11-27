import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { monthKey, monthLabel, shiftMonth, todayISO } from '../lib/dates.ts'
import { mad } from '../lib/format.ts'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export const fieldClass =
  'w-full rounded-lg border border-line bg-soft px-3 py-2.5 outline-none focus:border-gold'

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="text-center">
        <p className="num text-5xl text-gold">DH</p>
        <p className="mt-2 text-sm tracking-wide text-muted">Moneymoney</p>
      </div>
    </div>
  )
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={() => closeRef.current()} />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-elev px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" className="rounded-md bg-soft px-3 py-1.5 text-sm font-semibold text-muted" onClick={() => closeRef.current()}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs leading-relaxed text-muted">{children}</p>
}

export function Button({
  tone = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const tones = {
    primary: 'bg-gold font-medium text-on',
    ghost: 'bg-soft text-ink',
    danger: 'bg-soft text-bad',
  }
  return <button type={type} className={cx('rounded-lg px-4 py-2.5 text-[15px] font-semibold disabled:opacity-40', tones[tone], className)} {...props} />
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea className={fieldClass} rows={2} value={value} placeholder={placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={fieldClass} value={value} placeholder={placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  )
}

export function AmountField({ label = 'Montant', value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-soft px-3">
        <input
          className="num w-full bg-transparent py-2.5 text-2xl font-semibold outline-none"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-sm text-muted">DH</span>
      </div>
    </Field>
  )
}

export function DateField({ label = 'Date', value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input className={fieldClass} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <Field label={label}>
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </Field>
  )
}

export function CheckRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  detail?: string
}) {
  return (
    <label className="mb-3 flex items-start gap-3 rounded-2xl bg-soft px-4 py-3">
      <input className="mt-1 h-4 w-4 accent-[var(--gold)]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm">{title}</span>
        {detail && <span className="mt-1 block text-xs leading-relaxed text-muted">{detail}</span>}
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="mb-4 grid gap-1 rounded-lg bg-soft p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cx('rounded-md px-1 py-2 text-sm font-semibold', value === option.id ? 'bg-elev text-gold shadow-sm' : 'text-muted')}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-soft">
      <div className="h-full rounded-full bg-gold" style={{ width: `${width}%` }} />
    </div>
  )
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'bad' | 'gold' }) {
  const tones = { muted: 'text-muted', good: 'text-good', bad: 'text-bad', gold: 'text-gold' }
  return <span className={cx('rounded-full bg-soft px-2 py-0.5 text-[11px]', tones[tone])}>{children}</span>
}

export function PageHeader({ title, kicker, action }: { title: string; kicker?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="mb-1 text-sm text-muted">{kicker}</p>}
        <h1 className="font-serif text-4xl leading-none tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-elev px-4 py-8 text-center ring-1 ring-line">
      <p className="font-serif text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function MoneyText({ value, className = '' }: { value: number; className?: string }) {
  return <span className={cx('num', className)}>{mad(value)}</span>
}

export function MonthPager({ ym, onChange }: { ym: string; onChange: (ym: string) => void }) {
  const current = monthKey(todayISO())
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-soft text-lg" onClick={() => onChange(shiftMonth(ym, -1))} aria-label="Mois précédent">
        ‹
      </button>
      <div className="text-center">
        <p className="font-serif text-xl capitalize">{monthLabel(ym)}</p>
        {ym !== current && (
          <button type="button" className="text-xs text-gold" onClick={() => onChange(current)}>
            Revenir à ce mois
          </button>
        )}
      </div>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-soft text-lg" onClick={() => onChange(shiftMonth(ym, 1))} aria-label="Mois suivant">
        ›
      </button>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="mb-3 text-sm text-bad" role="alert">
      {children}
    </p>
  )
}
