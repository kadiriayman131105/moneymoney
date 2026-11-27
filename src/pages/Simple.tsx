import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NouranCaisse } from './NouranCaisse.tsx'
import { AmountField, Button, DateField, ErrorText, Segmented, Sheet, TextField } from '../components/ui.tsx'
import { isISODate, shortDate, todayISO } from '../lib/dates.ts'
import { amountToInput, mad, parseAmount, round2 } from '../lib/format.ts'
import { readKept, writeKept } from '../lib/keep.ts'

type Kind = 'credit' | 'loan'
type View = 'now' | 'history'

type Payment = {
  id: string
  amount: number
  date: string
}

type Entry = {
  id: string
  kind: Kind
  name: string
  amount: number
  date: string
  reason: string
  settled: boolean
  closedManually: boolean
  settledAt?: string
  payments: Payment[]
}

const KEY = 'mm-simple-v1'

function paidOf(entry: Entry) {
  return round2(entry.payments.reduce((sum, payment) => sum + payment.amount, 0))
}

function leftOf(entry: Entry) {
  if (entry.settled) return 0
  return round2(Math.max(0, entry.amount - paidOf(entry)))
}

function syncEntry(entry: Entry, payments: Payment[]) {
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const fullyPaid = paid >= entry.amount - 0.001
  const settled = entry.closedManually || fullyPaid
  return {
    ...entry,
    payments,
    settled,
    ...(settled ? { settledAt: entry.settledAt ?? todayISO() } : { settledAt: undefined }),
  }
}

function normalize(row: Partial<Entry>): Entry | null {
  if (!row.id || !row.name || typeof row.amount !== 'number') return null
  if (row.kind !== 'credit' && row.kind !== 'loan') return null
  const payments = Array.isArray(row.payments)
    ? row.payments.flatMap((payment) => {
      if (!payment?.id || typeof payment.amount !== 'number' || !isISODate(payment.date)) return []
      return [{ id: payment.id, amount: payment.amount, date: payment.date }]
    })
    : []
  const settled = Boolean(row.settled)
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    amount: row.amount,
    date: row.date && isISODate(row.date) ? row.date : todayISO(),
    reason: typeof row.reason === 'string' ? row.reason : '',
    settled,
    closedManually: Boolean(row.closedManually) || settled,
    ...(row.settledAt && isISODate(row.settledAt) ? { settledAt: row.settledAt } : settled ? { settledAt: row.date && isISODate(row.date) ? row.date : todayISO() } : {}),
    payments,
  }
}

function load(): { entries: Entry[]; protect: boolean } {
  try {
    const raw = readKept(KEY)
    if (!raw) return { entries: [], protect: false }
    const data = JSON.parse(raw) as Partial<Entry>[]
    if (!Array.isArray(data)) return { entries: [], protect: true }
    const entries = data.flatMap((row) => {
      const entry = normalize(row)
      return entry ? [entry] : []
    })
    return { entries, protect: data.length > 0 && entries.length === 0 }
  } catch {
    return { entries: [], protect: true }
  }
}

export function Simple() {
  const [loaded] = useState(load)
  const protect = useRef(loaded.protect)
  const [entries, setEntries] = useState<Entry[]>(loaded.entries)
  const [view, setView] = useState<View>('now')
  const [space, setSpace] = useState<'moi' | 'nouran'>('moi')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('credit')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (protect.current) return
    writeKept(KEY, JSON.stringify(entries))
  }, [entries])

  const editing = entries.find((entry) => entry.id === editId) ?? null
  const paying = entries.find((entry) => entry.id === payId) ?? null
  const needle = query.trim().toLowerCase()
  const found = (entry: Entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.reason.toLowerCase().includes(needle)
  const openEntries = entries.filter((entry) => leftOf(entry) > 0)
  const active = openEntries.filter(found)
  const credits = active.filter((entry) => entry.kind === 'credit')
  const loans = active.filter((entry) => entry.kind === 'loan')
  const owed = round2(openEntries.filter((entry) => entry.kind === 'credit').reduce((sum, entry) => sum + leftOf(entry), 0))
  const incoming = round2(openEntries.filter((entry) => entry.kind === 'loan').reduce((sum, entry) => sum + leftOf(entry), 0))

  function reset() {
    setKind('credit')
    setName('')
    setAmount('')
    setDate(todayISO())
    setReason('')
    setError(null)
    setPayAmount('')
    setPayDate(todayISO())
    setPayError(null)
  }

  function readForm() {
    const parsed = parseAmount(amount)
    if (!name.trim()) {
      setError('Écris le nom.')
      return null
    }
    if (parsed == null) {
      setError('Écris le montant.')
      return null
    }
    if (!isISODate(date)) {
      setError('Choisis une date.')
      return null
    }
    return { kind, name: name.trim(), amount: parsed, date, reason: reason.trim() }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = readForm()
    if (!next) return
    setEntries((current) => [
      { id: crypto.randomUUID(), ...next, settled: false, closedManually: false, payments: [] },
      ...current,
    ])
    setOpen(false)
    reset()
  }

  function openEdit(entry: Entry) {
    setEditId(entry.id)
    setKind(entry.kind)
    setName(entry.name)
    setAmount(amountToInput(entry.amount))
    setDate(entry.date)
    setReason(entry.reason)
    setError(null)
    setPayAmount('')
    setPayDate(todayISO())
    setPayError(null)
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const next = readForm()
    if (!next) return
    if (next.amount + 0.001 < paidOf(editing)) {
      setError('Le montant est plus petit que les acomptes déjà notés.')
      return
    }
    const settled = editing.closedManually || round2(next.amount - paidOf(editing)) <= 0
    setEntries((current) => current.map((entry) => entry.id === editing.id ? { ...entry, ...next, settled, ...(settled ? { settledAt: entry.settledAt ?? todayISO() } : { settledAt: undefined }) } : entry))
    setEditId(null)
    reset()
  }

  function settle(id: string) {
    setEntries((current) => current.map((entry) => entry.id === id
      ? { ...entry, settled: true, closedManually: true, settledAt: todayISO() }
      : entry))
    setEditId(null)
    setPayId(null)
  }

  function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id))
    setEditId(null)
  }

  function openPayments(id: string) {
    setPayId(id)
    setPayAmount('')
    setPayDate(todayISO())
    setPayError(null)
  }

  function addPayment(event: FormEvent) {
    event.preventDefault()
    if (!paying) return
    const parsed = parseAmount(payAmount)
    if (parsed == null) {
      setPayError('Écris le montant de l’acompte.')
      return
    }
    if (!isISODate(payDate)) {
      setPayError('Choisis la date de cet acompte.')
      return
    }
    const left = leftOf(paying)
    if (parsed - left > 0.001) {
      setPayError(`Il reste ${mad(left)}.`)
      return
    }
    const payment: Payment = { id: crypto.randomUUID(), amount: parsed, date: payDate }
    const payments = [...paying.payments, payment]
    setEntries((current) => current.map((entry) => entry.id === paying.id ? syncEntry(entry, payments) : entry))
    setPayAmount('')
    setPayDate(todayISO())
    setPayError(null)
  }

  function changePaymentDate(paymentId: string, nextDate: string) {
    if (!paying || !isISODate(nextDate)) return
    setEntries((current) => current.map((entry) => entry.id === paying.id
      ? { ...entry, payments: entry.payments.map((payment) => payment.id === paymentId ? { ...payment, date: nextDate } : payment) }
      : entry))
  }

  function removePayment(paymentId: string) {
    if (!paying) return
    const payments = paying.payments.filter((payment) => payment.id !== paymentId)
    setEntries((current) => current.map((entry) => entry.id === paying.id ? syncEntry(entry, payments) : entry))
  }

  const history = historyOf(entries)

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-elev">
        <div className="mx-auto flex h-14 max-w-md items-center justify-center px-4">
          <div className="flex rounded-full bg-soft p-1 text-[15px] font-semibold">
            <button type="button" className={space === 'moi' ? 'rounded-full bg-elev px-6 py-1.5 text-gold shadow-sm' : 'rounded-full px-6 py-1.5 text-muted'} onClick={() => setSpace('moi')}>Moi</button>
            <button type="button" className={space === 'nouran' ? 'rounded-full bg-elev px-6 py-1.5 text-gold shadow-sm' : 'rounded-full px-6 py-1.5 text-muted'} onClick={() => setSpace('nouran')}>Nouran</button>
          </div>
        </div>
      </header>

      {space === 'nouran' ? <NouranCaisse /> : (
      <>
      <div className="mx-auto w-full max-w-md px-4 pt-3 pb-28">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: 'now', label: 'En cours' },
            { id: 'history', label: 'Historique' },
          ]}
        />
        <input
          className="mb-3 w-full rounded-full border border-line bg-soft px-4 py-2.5 text-[15px] outline-none focus:border-gold"
          value={query}
          placeholder="Rechercher un nom ou une raison"
          onChange={(event) => setQuery(event.target.value)}
        />

        {view === 'now' ? (
          <>
            <button
              type="button"
              className="mb-3 flex w-full items-center gap-3 rounded-lg bg-elev px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              onClick={() => { reset(); setOpen(true) }}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-xl font-semibold text-on">+</span>
              <span className="text-[15px] text-muted">Ajouter un crédit ou un prêt</span>
            </button>

            <section className="grid grid-cols-2 overflow-hidden rounded-lg bg-elev shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
              <div className="border-r border-line px-4 py-3">
                <p className="text-[13px] text-muted">Je dois</p>
                <p className="num mt-0.5 text-xl font-bold text-bad">{mad(owed)}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[13px] text-muted">On me doit</p>
                <p className="num mt-0.5 text-xl font-bold text-good">{mad(incoming)}</p>
              </div>
            </section>

            {active.length === 0 && (
              <p className="mt-4 rounded-lg bg-elev px-4 py-6 text-center text-[15px] leading-relaxed text-muted shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                {needle ? 'Aucun résultat.' : 'Exemple : Yacine t’a donné 500 DH. Tu choisis Crédit, la date et la raison.'}
              </p>
            )}

            <Group title="Crédits" entries={credits} onOpen={openEdit} onPayments={openPayments} />
            <Group title="Prêts" entries={loans} onOpen={openEdit} onPayments={openPayments} />
          </>
        ) : (
          <HistoryList items={history.filter((item) => !needle || `${item.name} ${item.label} ${item.detail}`.toLowerCase().includes(needle))} empty={needle ? 'Aucun résultat.' : 'Les crédits, les prêts et les acomptes apparaîtront ici.'} />
        )}
      </div>

      <button
        type="button"
        className="fixed right-4 bottom-6 grid h-14 w-14 place-items-center rounded-full bg-gold text-3xl font-semibold text-on shadow-[0_4px_12px_rgba(8,102,255,0.45)]"
        aria-label="Ajouter"
        onClick={() => { reset(); setOpen(true) }}
      >
        +
      </button>

      <Sheet open={open} title="Ajouter" onClose={() => setOpen(false)}>
        <EntryForm
          kind={kind}
          name={name}
          amount={amount}
          date={date}
          reason={reason}
          error={error}
          submitLabel="Enregistrer"
          onKind={setKind}
          onName={setName}
          onAmount={setAmount}
          onDate={setDate}
          onReason={setReason}
          onSubmit={submit}
        />
      </Sheet>

      <Sheet open={editing != null} title={editing?.name ?? 'Modifier'} onClose={() => setEditId(null)}>
        {editing && (
          <>
            <EntryForm
              kind={kind}
              name={name}
              amount={amount}
              date={date}
              reason={reason}
              error={error}
              submitLabel="Enregistrer"
              onKind={setKind}
              onName={setName}
              onAmount={setAmount}
              onDate={setDate}
              onReason={setReason}
              onSubmit={saveEdit}
            />
            <Button type="button" tone="ghost" className="mt-2 w-full" onClick={() => openPayments(editing.id)}>Acomptes</Button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button tone="ghost" onClick={() => settle(editing.id)}>C’est réglé</Button>
              <Button
                tone="danger"
                onClick={() => {
                  if (window.confirm(`Supprimer ${editing.name} et son historique ?`)) remove(editing.id)
                }}
              >
                Supprimer
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={paying != null} title={paying ? `Acomptes · ${paying.name}` : 'Acomptes'} onClose={() => setPayId(null)}>
        {paying && (
          <Payments
            entry={paying}
            amount={payAmount}
            date={payDate}
            error={payError}
            onAmount={setPayAmount}
            onDate={setPayDate}
            onAdd={addPayment}
            onChangeDate={changePaymentDate}
            onRemove={removePayment}
          />
        )}
      </Sheet>
      </>
      )}
    </div>
  )
}

function EntryForm({
  kind,
  name,
  amount,
  date,
  reason,
  error,
  submitLabel,
  onKind,
  onName,
  onAmount,
  onDate,
  onReason,
  onSubmit,
}: {
  kind: Kind
  name: string
  amount: string
  date: string
  reason: string
  error: string | null
  submitLabel: string
  onKind: (kind: Kind) => void
  onName: (name: string) => void
  onAmount: (amount: string) => void
  onDate: (date: string) => void
  onReason: (reason: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <Segmented
        value={kind}
        onChange={onKind}
        options={[
          { id: 'credit', label: 'Crédit' },
          { id: 'loan', label: 'Prêt' },
        ]}
      />
      <p className="mb-3 text-sm text-muted">
        {kind === 'credit' ? 'Quelqu’un t’a donné cet argent. Tu le dois.' : 'Tu as prêté cet argent. On doit te le rendre.'}
      </p>
      <TextField label="Nom" value={name} onChange={onName} placeholder="Yacine" />
      <AmountField label="Montant total" value={amount} onChange={onAmount} />
      <DateField label="Date" value={date} onChange={onDate} />
      <TextField label="Raison" value={reason} onChange={onReason} placeholder="Loyer, téléphone, aide…" />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  )
}

function Payments({
  entry,
  amount,
  date,
  error,
  onAmount,
  onDate,
  onAdd,
  onChangeDate,
  onRemove,
}: {
  entry: Entry
  amount: string
  date: string
  error: string | null
  onAmount: (value: string) => void
  onDate: (value: string) => void
  onAdd: (event: FormEvent) => void
  onChangeDate: (id: string, date: string) => void
  onRemove: (id: string) => void
}) {
  const left = leftOf(entry)
  const payments = [...entry.payments].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <section>
      <h3 className="text-[15px] font-bold">Chaque acompte a sa date</h3>
      <p className="mt-1 text-[13px] text-muted">Reste {mad(left)}. Chaque acompte a sa date.</p>
      <div className="mt-3 space-y-2">
        {payments.map((payment) => (
          <div key={payment.id} className="flex items-center gap-2 rounded-lg border border-line bg-soft px-2 py-2">
            <p className="num w-24 shrink-0 text-sm font-semibold">{mad(payment.amount)}</p>
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-elev px-2 py-1.5 text-sm"
              type="date"
              value={payment.date}
              aria-label={`Date de l’acompte ${mad(payment.amount)}`}
              onChange={(event) => onChangeDate(payment.id, event.target.value)}
            />
            <button type="button" className="px-1 text-sm font-semibold text-bad" onClick={() => onRemove(payment.id)} aria-label="Supprimer cet acompte">
              ×
            </button>
          </div>
        ))}
      </div>
      {left > 0 && (
        <form className="mt-3" onSubmit={onAdd}>
          <AmountField label="Nouvel acompte" value={amount} onChange={onAmount} />
          <DateField label="Date de cet acompte" value={date} onChange={onDate} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Ajouter l’acompte</Button>
        </form>
      )}
    </section>
  )
}

function Group({ title, entries, onOpen, onPayments }: { title: string; entries: Entry[]; onOpen: (entry: Entry) => void; onPayments: (id: string) => void }) {
  if (entries.length === 0) return null
  return (
    <section className="mt-4">
      <h2 className="mb-2 px-1 text-[15px] font-bold">{title}</h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Card key={entry.id} entry={entry} onOpen={() => onOpen(entry)} onPayments={() => onPayments(entry.id)} />
        ))}
      </div>
    </section>
  )
}

function Card({ entry, onOpen, onPayments }: { entry: Entry; onOpen: () => void; onPayments: () => void }) {
  const credit = entry.kind === 'credit'
  const letter = entry.name.trim().slice(0, 1).toUpperCase()
  const count = entry.payments.length
  return (
    <div className={credit
      ? 'flex items-center gap-2 rounded-lg border-2 border-[#e41e3f] bg-elev px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
      : 'flex items-center gap-2 rounded-lg border-2 border-[#31a24c] bg-elev px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={credit
          ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e41e3f] text-sm font-bold text-white'
          : 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#31a24c] text-sm font-bold text-white'}>
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{entry.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {shortDate(entry.date)}{entry.reason ? ` · ${entry.reason}` : ''}
          </span>
        </span>
        <span className={credit ? 'num text-[15px] font-bold text-bad' : 'num text-[15px] font-bold text-good'}>{mad(leftOf(entry))}</span>
      </button>
      <button type="button" onClick={onPayments} className="shrink-0 rounded-md bg-soft px-2 py-1.5 text-xs font-semibold text-gold">
        {count > 0 ? `${count} acompte${count > 1 ? 's' : ''}` : 'Acomptes'}
      </button>
    </div>
  )
}

type HistoryItem = {
  id: string
  date: string
  name: string
  label: string
  detail: string
  amount: number
  credit: boolean
  settled: boolean
}

function historyOf(entries: Entry[]): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const entry of entries) {
    items.push({
      id: `open-${entry.id}`,
      date: entry.date,
      name: entry.name,
      label: entry.kind === 'credit' ? 'Crédit' : 'Prêt',
      detail: entry.reason,
      amount: entry.amount,
      credit: entry.kind === 'credit',
      settled: entry.settled,
    })
    for (const payment of entry.payments) {
      items.push({
        id: payment.id,
        date: payment.date,
        name: entry.name,
        label: 'Acompte',
        detail: entry.kind === 'credit' ? 'Tu as rendu' : 'On t’a rendu',
        amount: payment.amount,
        credit: entry.kind === 'credit',
        settled: entry.settled,
      })
    }
    if (entry.settled && entry.settledAt) {
      items.push({
        id: `settled-${entry.id}`,
        date: entry.settledAt,
        name: entry.name,
        label: 'Réglé',
        detail: entry.reason,
        amount: entry.amount,
        credit: entry.kind === 'credit',
        settled: true,
      })
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

function HistoryList({ items, empty }: { items: HistoryItem[]; empty: string }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-elev px-4 py-6 text-center text-[15px] text-muted shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
        {empty}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article key={item.id} className="flex items-center gap-3 rounded-lg border border-line bg-elev px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className={item.credit ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e41e3f] text-xs font-bold text-white' : 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#31a24c] text-xs font-bold text-white'}>
            {item.label.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{item.name}</span>
            <span className="block truncate text-[13px] text-muted">
              {shortDate(item.date)} · {item.label}{item.settled ? ' · Réglé' : ''}{item.detail ? ` · ${item.detail}` : ''}
            </span>
          </span>
          <span className={item.label === 'Acompte' || item.label === 'Réglé' ? 'num text-[15px] font-bold text-ink' : item.credit ? 'num text-[15px] font-bold text-bad' : 'num text-[15px] font-bold text-good'}>
            {mad(item.amount)}
          </span>
        </article>
      ))}
    </div>
  )
}
