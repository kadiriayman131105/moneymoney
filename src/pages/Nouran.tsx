import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AmountField, Button, CheckRow, DateField, Empty, ErrorText, MonthPager, PageHeader, Segmented, SelectField, Sheet, TextField } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import { createNouran, deleteNouran } from '../lib/actions.ts'
import { nouranTotals } from '../lib/calc.ts'
import { monthKey, shortDate, todayISO } from '../lib/dates.ts'
import { errorMessage, mad, parseAmount } from '../lib/format.ts'
import { openAccounts } from '../lib/labels.ts'
import type { NouranKind } from '../types.ts'

const KINDS: { id: NouranKind; label: string }[] = [
  { id: 'sale', label: 'Vente' },
  { id: 'purchase', label: 'Achat' },
  { id: 'fee', label: 'Frais' },
]

export function Nouran() {
  const { nouranEntries } = useMoney()
  const [ym, setYm] = useState(monthKey(todayISO()))
  const [open, setOpen] = useState(false)
  const month = nouranTotals(nouranEntries, ym)
  const all = nouranTotals(nouranEntries)
  const rows = nouranEntries.filter((entry) => entry.date.startsWith(ym))

  return (
    <div>
      <Link to="/plus" className="mb-3 inline-block text-sm text-gold">Retour</Link>
      <PageHeader title="Nouran Parfums" kicker="Le projet" action={<Button onClick={() => setOpen(true)}>Ajouter</Button>} />
      <MonthPager ym={ym} onChange={setYm} />
      <section className="hero-card rounded-[28px] p-5">
        <p className="text-sm text-muted">Bénéfice du mois</p>
        <p className={month.profit >= 0 ? 'num mt-1 text-4xl text-good' : 'num mt-1 text-4xl text-bad'}>{mad(month.profit)}</p>
        <p className="mt-2 text-xs text-muted">Depuis le début : {mad(all.profit)}</p>
      </section>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Ventes" value={month.sale} />
        <Stat label="Achats" value={month.purchase} />
        <Stat label="Frais" value={month.fee} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Achats de stock, ventes et frais du parfum. Si tu relies une ligne à un compte, elle entre aussi dans ton argent personnel.
      </p>
      <div className="mt-4 space-y-2">
        {rows.length === 0 && <Empty title="Rien ce mois-ci" text="Ajoute une vente, un achat de flacons ou des frais de livraison." action={<Button onClick={() => setOpen(true)}>Ajouter</Button>} />}
        {rows.map((entry) => (
          <article key={entry.id} className="flex items-center gap-3 rounded-3xl bg-elev px-4 py-3 ring-1 ring-line">
            <div className="min-w-0 flex-1">
              <p className="truncate">{entry.product || entry.description || labelOf(entry.kind)}</p>
              <p className="truncate text-xs text-muted">
                {labelOf(entry.kind)} · {shortDate(entry.date)}
                {entry.quantity ? ` · ${entry.quantity}` : ''}
                {entry.accountId == null ? ' · hors compte' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className={entry.kind === 'sale' ? 'num text-sm text-good' : 'num text-sm text-bad'}>{mad(entry.amount)}</p>
              <button type="button" className="text-xs text-muted" onClick={() => { if (window.confirm('Supprimer cette ligne ?')) void deleteNouran(entry.id) }}>Supprimer</button>
            </div>
          </article>
        ))}
      </div>
      <Sheet open={open} title="Nouran Parfums" onClose={() => setOpen(false)}>
        <NouranForm onClose={() => setOpen(false)} />
      </Sheet>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl bg-elev p-3 ring-1 ring-line">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num text-sm">{mad(value)}</p>
    </article>
  )
}

function labelOf(kind: NouranKind) {
  return KINDS.find((item) => item.id === kind)?.label ?? kind
}

function NouranForm({ onClose }: { onClose: () => void }) {
  const { accounts } = useMoney()
  const visible = openAccounts(accounts)
  const [kind, setKind] = useState<NouranKind>('sale')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [touchAccount, setTouchAccount] = useState(true)
  const [accountId, setAccountId] = useState(visible[0]?.id ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (parsed == null) {
      setError('Indique un montant supérieur à zéro.')
      return
    }
    const qty = quantity.trim() ? parseAmount(quantity) : null
    if (quantity.trim() && qty == null) {
      setError('La quantité n’est pas valide.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createNouran({
        kind,
        amount: parsed,
        date,
        product,
        description,
        quantity: qty,
        accountId: touchAccount ? accountId : null,
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <Segmented value={kind} onChange={setKind} options={KINDS} />
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <TextField label="Produit" value={product} onChange={setProduct} placeholder="Oud, musc, coffret…" />
      <TextField label="Détail" value={description} onChange={setDescription} placeholder="Client, flacons, livraison, pub…" />
      <TextField label="Quantité" value={quantity} onChange={setQuantity} placeholder="Optionnel" />
      <CheckRow checked={touchAccount} onChange={setTouchAccount} title="Passer sur un compte" detail="La vente devient un revenu, l’achat ou les frais une dépense." />
      {touchAccount && (
        <SelectField label="Compte" value={accountId} onChange={(value) => setAccountId(Number(value))}>
          {visible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </SelectField>
      )}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Enregistrer</Button>
    </form>
  )
}
