import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AmountField, Button, DateField, ErrorText, Sheet, TextField } from '../components/ui.tsx'
import { isISODate, shortDate, todayISO } from '../lib/dates.ts'
import { amountToInput, mad, parseAmount, round2 } from '../lib/format.ts'
import { readKept, writeKept } from '../lib/keep.ts'

type Kind = 'sale' | 'credit' | 'purchase' | 'staff'

type Payment = { id: string; amount: number; date: string }

type Move = {
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

type Book = { opening: number; moves: Move[] }

const KEY = 'mm-nouran-v1'

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'sale', label: 'Vente', hint: 'Payé tout de suite. L’argent entre dans la caisse.' },
  { id: 'credit', label: 'Vente à crédit', hint: 'Le client paie plus tard. L’argent entre avec un acompte, ou tout le reste quand c’est réglé.' },
  { id: 'purchase', label: 'Achat', hint: 'Parfum, flacons, emballage. L’argent sort de la caisse.' },
  { id: 'staff', label: 'Prêt personnel', hint: 'L’argent sort tout de suite. Il revient avec un remboursement, ou le reste quand c’est réglé.' },
]

function paidOf(move: Move) {
  return round2(move.payments.reduce((sum, payment) => sum + payment.amount, 0))
}

function stillDue(move: Move) {
  if (move.kind !== 'credit' && move.kind !== 'staff') return 0
  return round2(Math.max(0, move.amount - paidOf(move)))
}

function leftOf(move: Move) {
  if (move.settled) return 0
  return stillDue(move)
}

function collectedOf(move: Move) {
  const paid = paidOf(move)
  if (move.settled) return round2(paid + stillDue(move))
  return paid
}

function syncMove(move: Move, payments: Payment[]) {
  if (move.kind !== 'credit' && move.kind !== 'staff') return { ...move, payments }
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const settled = move.closedManually || paid >= move.amount - 0.001
  return {
    ...move,
    payments,
    settled,
    ...(settled ? { settledAt: move.settledAt ?? todayISO() } : { settledAt: undefined }),
  }
}

function cashReport(opening: number, moves: Move[]) {
  let entered = 0
  let left = 0
  for (const move of moves) {
    if (move.kind === 'sale') entered += move.amount
    if (move.kind === 'purchase') left += move.amount
    if (move.kind === 'credit') entered += collectedOf(move)
    if (move.kind === 'staff') {
      left += move.amount
      entered += collectedOf(move)
    }
  }
  return { cash: round2(opening + entered - left), entered: round2(entered), left: round2(left) }
}

function normalize(row: Partial<Move>): Move | null {
  if (!row.id || !row.name || typeof row.amount !== 'number') return null
  if (row.kind !== 'sale' && row.kind !== 'credit' && row.kind !== 'purchase' && row.kind !== 'staff') return null
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
    ...(row.settledAt && isISODate(row.settledAt) ? { settledAt: row.settledAt } : {}),
    payments,
  }
}

function load(): { book: Book; protect: boolean } {
  const empty = { opening: 0, moves: [] }
  try {
    const raw = readKept(KEY)
    if (!raw) return { book: empty, protect: false }
    const data = JSON.parse(raw) as { opening?: number; moves?: Partial<Move>[] }
    const book = {
      opening: typeof data.opening === 'number' ? data.opening : 0,
      moves: Array.isArray(data.moves) ? data.moves.flatMap((row) => {
        const move = normalize(row)
        return move ? [move] : []
      }) : [],
    }
    const had = (typeof data.opening === 'number' && data.opening !== 0) || (Array.isArray(data.moves) && data.moves.length > 0)
    const blank = book.opening === 0 && book.moves.length === 0
    return { book, protect: had && blank }
  } catch {
    return { book: empty, protect: true }
  }
}

export function NouranCaisse() {
  const [loaded] = useState(load)
  const protect = useRef(loaded.protect)
  const [book, setBook] = useState<Book>(loaded.book)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [openingValue, setOpeningValue] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('sale')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (protect.current) return
    writeKept(KEY, JSON.stringify(book))
  }, [book])

  const editing = book.moves.find((move) => move.id === editId) ?? null
  const paying = book.moves.find((move) => move.id === payId) ?? null
  const needle = query.trim().toLowerCase()
  const found = (move: Move) => !needle || move.name.toLowerCase().includes(needle) || move.reason.toLowerCase().includes(needle)
  const cash = cashReport(book.opening, book.moves)
  const openMoves = book.moves.filter((move) => (move.kind === 'credit' || move.kind === 'staff') && leftOf(move) > 0)
  const credits = book.moves.filter((move) => move.kind === 'credit' && found(move))
  const staff = book.moves.filter((move) => move.kind === 'staff' && found(move))
  const toCollect = round2(openMoves.filter((move) => move.kind === 'credit').reduce((sum, move) => sum + leftOf(move), 0))
  const staffLeft = round2(openMoves.filter((move) => move.kind === 'staff').reduce((sum, move) => sum + leftOf(move), 0))

  function resetForm() {
    setKind('sale')
    setName('')
    setAmount('')
    setDate(todayISO())
    setReason('')
    setError(null)
  }

  function readForm() {
    const parsed = parseAmount(amount)
    const label = name.trim()
    if (!label) {
      setError(kind === 'purchase' ? 'Écris le produit.' : 'Écris le nom.')
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
    return { kind, name: label, amount: parsed, date, reason: reason.trim() }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = readForm()
    if (!next) return
    const move: Move = { id: crypto.randomUUID(), ...next, settled: false, closedManually: false, payments: [] }
    setBook((current) => ({ ...current, moves: [move, ...current.moves] }))
    setOpen(false)
    resetForm()
  }

  function openEdit(move: Move) {
    setEditId(move.id)
    setKind(move.kind)
    setName(move.name)
    setAmount(amountToInput(move.amount))
    setDate(move.date)
    setReason(move.reason)
    setError(null)
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const next = readForm()
    if (!next) return
    if ((editing.kind === 'credit' || editing.kind === 'staff') && next.amount + 0.001 < paidOf(editing)) {
      setError('Le montant est plus petit que les acomptes déjà notés.')
      return
    }
    setBook((current) => ({
      ...current,
      moves: current.moves.map((move) => move.id === editing.id ? syncMove({ ...move, ...next }, move.payments) : move),
    }))
    setEditId(null)
    resetForm()
  }

  function settle(id: string) {
    setBook((current) => ({
      ...current,
      moves: current.moves.map((move) => move.id === id ? { ...move, settled: true, closedManually: true, settledAt: todayISO() } : move),
    }))
    setEditId(null)
    setPayId(null)
  }

  function remove(id: string) {
    setBook((current) => ({ ...current, moves: current.moves.filter((move) => move.id !== id) }))
    setEditId(null)
    setPayId(null)
  }

  function openFromHistory(id: string) {
    const move = book.moves.find((item) => item.id === id)
    if (move) openEdit(move)
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
      setPayError('Choisis la date.')
      return
    }
    const left = leftOf(paying)
    if (parsed - left > 0.001) {
      setPayError(`Il reste ${mad(left)}.`)
      return
    }
    const payments = [...paying.payments, { id: crypto.randomUUID(), amount: parsed, date: payDate }]
    setBook((current) => ({ ...current, moves: current.moves.map((move) => move.id === paying.id ? syncMove(move, payments) : move) }))
    setPayAmount('')
    setPayDate(todayISO())
    setPayError(null)
  }

  function changePaymentDate(paymentId: string, nextDate: string) {
    if (!paying || !isISODate(nextDate)) return
    const payments = paying.payments.map((payment) => payment.id === paymentId ? { ...payment, date: nextDate } : payment)
    setBook((current) => ({ ...current, moves: current.moves.map((move) => move.id === paying.id ? { ...move, payments } : move) }))
  }

  function removePayment(paymentId: string) {
    if (!paying) return
    const payments = paying.payments.filter((payment) => payment.id !== paymentId)
    setBook((current) => ({ ...current, moves: current.moves.map((move) => move.id === paying.id ? syncMove(move, payments) : move) }))
  }

  function saveOpening(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(openingValue, { allowZero: true })
    if (parsed == null) return
    setBook((current) => ({ ...current, opening: parsed }))
    setOpeningOpen(false)
  }

  const journal = nouranHistory(book.moves).filter((item) => !needle || `${item.name} ${item.label} ${item.detail}`.toLowerCase().includes(needle))
  const encaissements = journal.filter((item) => item.tone === 'in')
  const achats = journal.filter((item) => item.label === 'Achat')
  const chosen = KINDS.find((item) => item.id === kind) ?? KINDS[0]

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3 pb-28">
      <button
        type="button"
        className="mb-3 w-full rounded-lg bg-[#0866ff] px-4 py-4 text-left text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
        onClick={() => { setOpeningValue(amountToInput(book.opening)); setOpeningOpen(true) }}
      >
        <p className="text-[13px] text-white/80">Caisse Nouran Parfums</p>
        <p className="num mt-1 text-3xl font-bold">{mad(cash.cash)}</p>
        <p className="mt-1 text-[13px] text-white/80">Départ {mad(book.opening)} · +{mad(cash.entered)} entrés · −{mad(cash.left)} sortis</p>
      </button>

      <input
        className="mb-3 w-full rounded-full border border-line bg-soft px-4 py-2.5 text-[15px] outline-none focus:border-gold"
        value={query}
        placeholder="Rechercher un client, un produit, un nom"
        onChange={(event) => setQuery(event.target.value)}
      />

      <button type="button" className="mb-3 flex w-full items-center gap-3 rounded-lg bg-elev px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.1)]" onClick={() => { resetForm(); setOpen(true) }}>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-xl font-semibold text-on">+</span>
        <span className="text-[15px] text-muted">Vente, achat ou prêt</span>
      </button>
      <section className="grid grid-cols-2 overflow-hidden rounded-lg bg-elev shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
        <div className="border-r border-line px-4 py-3">
          <p className="text-[13px] text-muted">Clients à encaisser</p>
          <p className="num mt-0.5 text-xl font-bold text-good">{mad(toCollect)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] text-muted">Personnel me doit</p>
          <p className="num mt-0.5 text-xl font-bold text-good">{mad(staffLeft)}</p>
        </div>
      </section>
      <h2 className="mt-5 mb-2 px-1 text-[15px] font-bold">Encaissements</h2>
      <HistoryList
        items={encaissements}
        empty={needle ? 'Aucun encaissement.' : 'Les ventes payées et les acomptes s’affichent ici.'}
        onOpen={openFromHistory}
      />

      <h2 className="mt-5 mb-2 px-1 text-[15px] font-bold">Achats</h2>
      <HistoryList
        items={achats}
        empty={needle ? 'Aucun achat.' : 'Parfum, flacons, emballage : l’argent qui sort.'}
        onOpen={openFromHistory}
      />

      <MoveGroup title="Ventes à crédit" moves={credits} onOpen={openEdit} onPayments={openPayments} empty={needle ? 'Aucune vente à crédit.' : 'Les clients qui paient plus tard.'} />
      <MoveGroup title="Prêts au personnel" moves={staff} onOpen={openEdit} onPayments={openPayments} empty={needle ? 'Aucun prêt.' : 'L’argent donné à l’équipe.'} />

      <button type="button" className="fixed right-4 bottom-6 grid h-14 w-14 place-items-center rounded-full bg-gold text-3xl font-semibold text-on shadow-[0_4px_12px_rgba(8,102,255,0.45)]" aria-label="Ajouter" onClick={() => { resetForm(); setOpen(true) }}>+</button>

      <Sheet open={openingOpen} title="Caisse de départ" onClose={() => setOpeningOpen(false)}>
        <form onSubmit={saveOpening}>
          <p className="mb-3 text-sm text-muted">L’argent déjà dans la caisse, avant les ventes et les achats notés ici. Exemple : 5 000 DH.</p>
          <AmountField label="Montant de départ" value={openingValue} onChange={setOpeningValue} />
          <Button type="submit" className="w-full">Enregistrer</Button>
        </form>
      </Sheet>

      <Sheet open={open} title="Nouran" onClose={() => setOpen(false)}>
        <KindPicker kind={kind} onChange={setKind} />
        <p className="mb-3 text-sm text-muted">{chosen.hint}</p>
        <MoveForm kind={kind} name={name} amount={amount} date={date} reason={reason} error={error} onName={setName} onAmount={setAmount} onDate={setDate} onReason={setReason} onSubmit={submit} />
      </Sheet>

      <Sheet open={editing != null} title={editing?.name ?? 'Modifier'} onClose={() => setEditId(null)}>
        {editing && (
          <>
            <KindPicker kind={kind} onChange={setKind} />
            <MoveForm kind={kind} name={name} amount={amount} date={date} reason={reason} error={error} onName={setName} onAmount={setAmount} onDate={setDate} onReason={setReason} onSubmit={saveEdit} />
            {(editing.kind === 'credit' || editing.kind === 'staff') && (
              <Button type="button" tone="ghost" className="mt-2 w-full" onClick={() => openPayments(editing.id)}>Acomptes</Button>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(editing.kind === 'credit' || editing.kind === 'staff') && <Button tone="ghost" onClick={() => settle(editing.id)}>C’est réglé</Button>}
              <Button tone="danger" onClick={() => { if (window.confirm(`Supprimer ${editing.name} ?`)) remove(editing.id) }}>Supprimer</Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={paying != null} title={paying ? `Acomptes · ${paying.name}` : 'Acomptes'} onClose={() => setPayId(null)}>
        {paying && (
          <div>
            <p className="mb-3 text-sm text-muted">Reste {mad(leftOf(paying))}. Cet argent entre dans la caisse.</p>
            <div className="space-y-2">
              {[...paying.payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => (
                <div key={payment.id} className="flex items-center gap-2 rounded-lg border border-line bg-soft px-2 py-2">
                  <p className="num w-24 shrink-0 text-sm font-semibold">{mad(payment.amount)}</p>
                  <input className="min-w-0 flex-1 rounded-md border border-line bg-elev px-2 py-1.5 text-sm" type="date" value={payment.date} aria-label={`Date de l’acompte ${mad(payment.amount)}`} onChange={(event) => changePaymentDate(payment.id, event.target.value)} />
                  <button type="button" className="px-1 text-sm font-semibold text-bad" aria-label="Supprimer cet acompte" onClick={() => removePayment(payment.id)}>×</button>
                </div>
              ))}
            </div>
            {leftOf(paying) > 0 && (
              <form className="mt-3" onSubmit={addPayment}>
                <AmountField label="Nouvel acompte" value={payAmount} onChange={setPayAmount} />
                <DateField label="Date de cet acompte" value={payDate} onChange={setPayDate} />
                <ErrorText>{payError}</ErrorText>
                <Button type="submit" className="w-full">Ajouter l’acompte</Button>
              </form>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}

function KindPicker({ kind, onChange }: { kind: Kind; onChange: (kind: Kind) => void }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      {KINDS.map((item) => (
        <button key={item.id} type="button" className={kind === item.id ? 'rounded-lg bg-gold px-2 py-2 text-sm font-semibold text-on' : 'rounded-lg bg-soft px-2 py-2 text-sm font-semibold text-ink'} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function MoveForm({
  kind, name, amount, date, reason, error, onName, onAmount, onDate, onReason, onSubmit,
}: {
  kind: Kind
  name: string
  amount: string
  date: string
  reason: string
  error: string | null
  onName: (value: string) => void
  onAmount: (value: string) => void
  onDate: (value: string) => void
  onReason: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  const person = kind === 'purchase' ? 'Produit' : kind === 'staff' ? 'Personnel' : 'Client'
  const detail = kind === 'purchase' ? 'Détail' : 'Produit ou raison'
  return (
    <form onSubmit={onSubmit}>
      <TextField label={person} value={name} onChange={onName} placeholder={kind === 'purchase' ? 'Parfum, flacons…' : kind === 'staff' ? 'Prénom' : 'Nom du client'} />
      <AmountField value={amount} onChange={onAmount} />
      <DateField value={date} onChange={onDate} />
      <TextField label={detail} value={reason} onChange={onReason} placeholder={kind === 'staff' ? 'Avance, salaire…' : 'Oud, musc, flacons…'} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full">Enregistrer</Button>
    </form>
  )
}

function MoveGroup({ title, moves, empty, onOpen, onPayments }: { title: string; moves: Move[]; empty: string; onOpen: (move: Move) => void; onPayments: (id: string) => void }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[15px] font-bold">{title}</h2>
      {moves.length === 0 ? (
        <p className="rounded-lg bg-elev px-4 py-6 text-center text-[15px] text-muted shadow-[0_1px_2px_rgba(0,0,0,0.1)]">{empty}</p>
      ) : (
        <div className="space-y-2">
          {moves.map((move) => {
            const closed = leftOf(move) <= 0
            return (
              <div key={move.id} className={closed ? 'flex items-center gap-2 rounded-lg border border-line bg-elev px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'flex items-center gap-2 rounded-lg border-2 border-[#31a24c] bg-elev px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'}>
                <button type="button" onClick={() => onOpen(move)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className={closed ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-sm font-bold text-ink' : 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#31a24c] text-sm font-bold text-white'}>{move.name.trim().slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{move.name}</span>
                    <span className="block truncate text-[13px] text-muted">{shortDate(move.date)}{move.reason ? ` · ${move.reason}` : ''}</span>
                  </span>
                  <span className={closed ? 'num text-[15px] font-bold text-muted' : 'num text-[15px] font-bold text-good'}>{closed ? 'Réglé' : mad(leftOf(move))}</span>
                </button>
                <button type="button" onClick={() => onPayments(move.id)} className="shrink-0 rounded-md bg-soft px-2 py-1.5 text-xs font-semibold text-gold">
                  {move.payments.length > 0 ? `${move.payments.length} acompte${move.payments.length > 1 ? 's' : ''}` : 'Acomptes'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

type HistoryItem = { id: string; moveId: string; date: string; name: string; label: string; detail: string; amount: number; tone: 'in' | 'out' | 'note' }

function nouranHistory(moves: Move[]): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const move of moves) {
    if (move.kind === 'sale') items.push({ id: move.id, moveId: move.id, date: move.date, name: move.name, label: 'Encaissement', detail: move.reason ? `Vente · ${move.reason}` : 'Vente', amount: move.amount, tone: 'in' })
    if (move.kind === 'purchase') items.push({ id: move.id, moveId: move.id, date: move.date, name: move.name, label: 'Achat', detail: move.reason, amount: move.amount, tone: 'out' })
    if (move.kind === 'credit') items.push({ id: move.id, moveId: move.id, date: move.date, name: move.name, label: 'Vente à crédit', detail: move.reason, amount: move.amount, tone: 'note' })
    if (move.kind === 'staff') items.push({ id: move.id, moveId: move.id, date: move.date, name: move.name, label: 'Prêt personnel', detail: move.reason, amount: move.amount, tone: 'out' })
    for (const payment of move.payments) {
      items.push({
        id: payment.id,
        moveId: move.id,
        date: payment.date,
        name: move.name,
        label: 'Encaissement',
        detail: move.kind === 'staff' ? 'Remboursement' : 'Acompte',
        amount: payment.amount,
        tone: 'in',
      })
    }
    const gap = stillDue(move)
    if (move.settled && gap > 0.001) {
      items.push({
        id: `settled-${move.id}`,
        moveId: move.id,
        date: move.settledAt && isISODate(move.settledAt) ? move.settledAt : move.date,
        name: move.name,
        label: 'Encaissement',
        detail: 'Réglé',
        amount: gap,
        tone: 'in',
      })
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

function HistoryList({ items, empty, onOpen }: { items: HistoryItem[]; empty: string; onOpen: (moveId: string) => void }) {
  if (items.length === 0) {
    return <p className="rounded-lg bg-elev px-4 py-6 text-center text-[15px] text-muted shadow-[0_1px_2px_rgba(0,0,0,0.1)]">{empty}</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.moveId)} className={item.tone === 'in' ? 'flex w-full items-center gap-3 rounded-lg border border-[#31a24c] bg-elev px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'flex w-full items-center gap-3 rounded-lg border border-[#e41e3f] bg-elev px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]'}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{item.name}</span>
            <span className="block truncate text-[13px] text-muted">{shortDate(item.date)} · {item.label}{item.detail ? ` · ${item.detail}` : ''}</span>
          </span>
          <span className={item.tone === 'in' ? 'num shrink-0 text-[15px] font-bold text-good' : item.tone === 'out' ? 'num shrink-0 text-[15px] font-bold text-bad' : 'num shrink-0 text-[15px] font-bold'}>
            {item.tone === 'out' ? '−' : item.tone === 'in' ? '+' : ''}{mad(item.amount)}
          </span>
        </button>
      ))}
    </div>
  )
}
