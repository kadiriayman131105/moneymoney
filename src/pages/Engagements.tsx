import { useState, type FormEvent } from 'react'
import { AmountField, Button, CheckRow, DateField, Empty, ErrorText, PageHeader, Pill, Progress, Segmented, SelectField, Sheet, TextField } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import {
  addPersonPayment,
  createCredit,
  createObligation,
  createPersonDebt,
  deleteCredit,
  deleteObligation,
  deletePersonDebt,
  deletePersonPayment,
  forgiveDebt,
  payCredit,
  payObligation,
  reopenDebt,
  unpayObligation,
  updateCredit,
  updateObligation,
  updatePersonDebt,
} from '../lib/actions.ts'
import { creditPaid, creditRemaining, debtPaid, debtRemaining, nextCredit, obligationDueDate } from '../lib/calc.ts'
import { monthKey, monthLabel, shiftMonth, shortDate, todayISO, addDays } from '../lib/dates.ts'
import { amountToInput, errorMessage, mad, parseAmount, round2 } from '../lib/format.ts'
import { openAccounts, openCategories } from '../lib/labels.ts'
import type { Credit, DebtDirection, Obligation, PersonDebt } from '../types.ts'

type Tab = 'lent' | 'owe' | 'credit' | 'bills'

export function Engagements() {
  const [tab, setTab] = useState<Tab>('lent')
  return (
    <div>
      <PageHeader title="Engagements" kicker="Prêts, dettes, crédits, mensualités" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'lent', label: 'Prêts' },
          { id: 'owe', label: 'Dettes' },
          { id: 'credit', label: 'Crédits' },
          { id: 'bills', label: 'Fixes' },
        ]}
      />
      {tab === 'lent' && <PeopleTab direction="lent" />}
      {tab === 'owe' && <PeopleTab direction="owe" />}
      {tab === 'credit' && <CreditsTab />}
      {tab === 'bills' && <BillsTab />}
    </div>
  )
}

function PeopleTab({ direction }: { direction: DebtDirection }) {
  const money = useMoney()
  const debts = money.personDebts.filter((debt) => debt.direction === direction)
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [payId, setPayId] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const remaining = round2(debts.reduce((sum, debt) => sum + debtRemaining(debt, money.personPayments), 0))
  const editing = debts.find((debt) => debt.id === editId) ?? null
  const paying = debts.find((debt) => debt.id === payId) ?? null
  const detail = debts.find((debt) => debt.id === detailId) ?? null
  const lent = direction === 'lent'

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{lent ? 'On me doit encore' : 'Je dois encore'}</p>
          <p className="num text-3xl">{mad(remaining)}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{lent ? 'Nouveau prêt' : 'Nouvelle dette'}</Button>
      </div>
      {debts.length === 0 ? (
        <Empty
          title={lent ? 'Personne ne te doit rien' : 'Tu ne dois rien à personne'}
          text={lent ? 'Note ici l’argent que tu as prêté, même si c’était avant de commencer l’app.' : 'Note une somme que tu dois rembourser à quelqu’un.'}
          action={<Button onClick={() => setCreating(true)}>Ajouter</Button>}
        />
      ) : (
        <div className="space-y-3">
          {debts.map((debt) => {
            const paid = debtPaid(debt.id, money.personPayments)
            const left = debtRemaining(debt, money.personPayments)
            return (
              <article key={debt.id} className="rounded-3xl bg-elev p-4 ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{debt.person}</h3>
                    <p className="text-xs text-muted">{shortDate(debt.date)}{debt.note ? ` · ${debt.note}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-xl">{mad(left)}</p>
                    <p className="text-xs text-muted">sur {mad(debt.amount)}</p>
                  </div>
                </div>
                <div className="my-3">
                  <Progress value={debt.amount === 0 ? 0 : debt.settled ? 100 : (paid / debt.amount) * 100} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {debt.forgiven && <Pill tone="gold">Clôturé</Pill>}
                  {debt.settled && !debt.forgiven && <Pill tone="good">Soldé</Pill>}
                  {!debt.settled && <Button onClick={() => setPayId(debt.id)}>{lent ? 'Remboursement' : 'J’ai payé'}</Button>}
                  <Button tone="ghost" onClick={() => setDetailId(debt.id)}>Détails</Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Sheet open={creating || editing != null} title={editing ? 'Modifier' : lent ? 'Nouveau prêt' : 'Nouvelle dette'} onClose={() => { setCreating(false); setEditId(null) }}>
        {(creating || editing) && (
          <DebtForm
            key={editing?.id ?? 'new'}
            direction={direction}
            initial={editing ?? undefined}
            onClose={() => { setCreating(false); setEditId(null) }}
          />
        )}
      </Sheet>
      <Sheet open={paying != null} title={lent ? 'Remboursement reçu' : 'Remboursement versé'} onClose={() => setPayId(null)}>
        {paying && <PayDebtForm key={paying.id} debt={paying} onClose={() => setPayId(null)} />}
      </Sheet>
      <Sheet open={detail != null} title={detail?.person ?? 'Détail'} onClose={() => setDetailId(null)}>
        {detail && (
          <DebtDetail
            debt={detail}
            onEdit={() => { setDetailId(null); setEditId(detail.id) }}
            onClose={() => setDetailId(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function DebtForm({ direction, initial, onClose }: { direction: DebtDirection; initial?: PersonDebt; onClose: () => void }) {
  const { accounts } = useMoney()
  const visible = openAccounts(accounts)
  const [person, setPerson] = useState(initial?.person ?? '')
  const [amount, setAmount] = useState(initial ? amountToInput(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [note, setNote] = useState(initial?.note ?? '')
  const [touchAccount, setTouchAccount] = useState(initial == null)
  const [accountId, setAccountId] = useState(visible[0]?.id ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lent = direction === 'lent'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (parsed == null) {
      setError('Indique un montant supérieur à zéro.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (initial) await updatePersonDebt(initial.id, { person, amount: parsed, date, note })
      else await createPersonDebt({ direction, person, amount: parsed, date, note, accountId: touchAccount ? accountId : null })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextField label="Personne" value={person} onChange={setPerson} placeholder="Prénom" />
      <AmountField label={initial ? 'Montant total' : 'Montant'} value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <TextField label="Note" value={note} onChange={setNote} placeholder="Pourquoi, quand…" />
      {!initial && (
        <CheckRow
          checked={touchAccount}
          onChange={setTouchAccount}
          title={lent ? 'Cet argent sort d’un compte maintenant' : 'Cet argent arrive sur un compte maintenant'}
          detail={lent
            ? 'Décoche si tu l’avais déjà prêté avant l’app. Ton solde actuel ne bougera pas.'
            : 'Décoche si cette dette existait déjà. Ton solde actuel ne bougera pas.'}
        />
      )}
      {!initial && touchAccount && (
        <SelectField label="Compte" value={accountId} onChange={(value) => setAccountId(Number(value))}>
          {visible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </SelectField>
      )}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Enregistrer</Button>
    </form>
  )
}

function PayDebtForm({ debt, onClose }: { debt: PersonDebt; onClose: () => void }) {
  const { accounts, personPayments } = useMoney()
  const visible = openAccounts(accounts)
  const left = debtRemaining(debt, personPayments)
  const [amount, setAmount] = useState(left > 0 ? amountToInput(left) : '')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
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
    setSaving(true)
    setError(null)
    try {
      await addPersonPayment({ debtId: debt.id, amount: parsed, date, note, accountId: touchAccount ? accountId : null })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <p className="mb-3 text-sm text-muted">Reste : {mad(left)}</p>
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <TextField label="Note" value={note} onChange={setNote} />
      <CheckRow
        checked={touchAccount}
        onChange={setTouchAccount}
        title={debt.direction === 'lent' ? 'Ajouter cet argent à un compte' : 'Retirer cet argent d’un compte'}
        detail="Décoche si le mouvement de compte est déjà compté ailleurs."
      />
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

function DebtDetail({ debt, onEdit, onClose }: { debt: PersonDebt; onEdit: () => void; onClose: () => void }) {
  const { personPayments } = useMoney()
  const payments = personPayments.filter((payment) => payment.debtId === debt.id).sort((a, b) => b.date.localeCompare(a.date))
  const left = debtRemaining(debt, personPayments)

  return (
    <div>
      <p className="num text-3xl">{mad(left)}</p>
      <p className="mb-3 text-sm text-muted">reste sur {mad(debt.amount)}</p>
      {debt.note && <p className="mb-3 text-sm">{debt.note}</p>}
      <div className="mb-4 space-y-2">
        {payments.length === 0 && <p className="text-sm text-muted">Aucun remboursement pour l’instant.</p>}
        {payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-soft px-3 py-2">
            <div>
              <p className="num text-sm">{mad(payment.amount)}</p>
              <p className="text-xs text-muted">{shortDate(payment.date)}{payment.note ? ` · ${payment.note}` : ''}</p>
            </div>
            <button type="button" className="text-xs text-bad" onClick={() => { if (window.confirm('Supprimer ce remboursement ?')) void deletePersonPayment(payment.id) }}>
              Supprimer
            </button>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Button tone="ghost" onClick={onEdit}>Modifier</Button>
        {!debt.settled && (
          <Button tone="ghost" onClick={() => { if (window.confirm('Le reste ne sera plus compté dans ton patrimoine.')) void forgiveDebt(debt.id) }}>
            Clôturer le reste
          </Button>
        )}
        {debt.forgiven && <Button tone="ghost" onClick={() => void reopenDebt(debt.id)}>Rouvrir</Button>}
        <Button tone="danger" onClick={() => { if (window.confirm('Supprimer ce dossier et ses mouvements de compte ?')) { void deletePersonDebt(debt.id); onClose() } }}>
          Supprimer
        </Button>
      </div>
    </div>
  )
}

function CreditsTab() {
  const money = useMoney()
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [payId, setPayId] = useState<number | null>(null)
  const left = round2(money.credits.reduce((sum, credit) => sum + creditRemaining(credit, money.creditPayments), 0))
  const editing = money.credits.find((credit) => credit.id === editId) ?? null
  const paying = money.credits.find((credit) => credit.id === payId) ?? null

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Capital encore dû</p>
          <p className="num text-3xl">{mad(left)}</p>
        </div>
        <Button onClick={() => setCreating(true)}>Nouveau crédit</Button>
      </div>
      {money.credits.length === 0 ? (
        <Empty title="Aucun crédit" text="Banque, société ou particulier : note ce qu’il reste à payer et la mensualité." action={<Button onClick={() => setCreating(true)}>Ajouter</Button>} />
      ) : (
        <div className="space-y-3">
          {money.credits.map((credit) => {
            const paid = creditPaid(credit.id, money.creditPayments)
            const remaining = creditRemaining(credit, money.creditPayments)
            const next = nextCredit(credit, money.creditPayments)
            return (
              <article key={credit.id} className="rounded-3xl bg-elev p-4 ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{credit.name}</h3>
                    <p className="text-xs text-muted">{credit.lender || 'Crédit'} · {mad(credit.monthlyPayment)} / mois</p>
                  </div>
                  <p className="num text-xl">{mad(remaining)}</p>
                </div>
                <div className="my-3"><Progress value={credit.totalAmount === 0 ? 0 : (paid / credit.totalAmount) * 100} /></div>
                {next && <p className="mb-3 text-xs text-muted">Prochaine échéance {shortDate(next.date)} · {mad(next.amount)}</p>}
                {!next && <p className="mb-3 text-xs text-good">Soldé</p>}
                <div className="flex gap-2">
                  {next && <Button onClick={() => setPayId(credit.id)}>Payer</Button>}
                  <Button tone="ghost" onClick={() => setEditId(credit.id)}>Modifier</Button>
                  <Button tone="danger" onClick={() => { if (window.confirm('Supprimer ce crédit et ses échéances ?')) void deleteCredit(credit.id) }}>Supprimer</Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Sheet open={creating || editing != null} title={editing ? 'Modifier le crédit' : 'Nouveau crédit'} onClose={() => { setCreating(false); setEditId(null) }}>
        {(creating || editing) && <CreditForm key={editing?.id ?? 'new'} initial={editing ?? undefined} onClose={() => { setCreating(false); setEditId(null) }} />}
      </Sheet>
      <Sheet open={paying != null} title="Payer une échéance" onClose={() => setPayId(null)}>
        {paying && <PayCreditForm key={paying.id} credit={paying} onClose={() => setPayId(null)} />}
      </Sheet>
    </div>
  )
}

function CreditForm({ initial, onClose }: { initial?: Credit; onClose: () => void }) {
  const { accounts } = useMoney()
  const visible = openAccounts(accounts)
  const [name, setName] = useState(initial?.name ?? '')
  const [lender, setLender] = useState(initial?.lender ?? '')
  const [total, setTotal] = useState(initial ? amountToInput(initial.totalAmount) : '')
  const [monthly, setMonthly] = useState(initial ? amountToInput(initial.monthlyPayment) : '')
  const [date, setDate] = useState(initial?.startDate ?? todayISO())
  const [months, setMonths] = useState(initial ? String(initial.months) : '12')
  const [accountId, setAccountId] = useState(initial?.accountId ?? visible[0]?.id ?? 0)
  const [note, setNote] = useState(initial?.note ?? '')
  const [receive, setReceive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const totalAmount = parseAmount(total)
    const monthlyPayment = parseAmount(monthly)
    const count = Number(months)
    if (totalAmount == null || monthlyPayment == null) {
      setError('Indique le reste dû et la mensualité.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (initial) {
        await updateCredit(initial.id, { name, lender, totalAmount, monthlyPayment, startDate: date, months: count, accountId, note })
      } else {
        await createCredit({ name, lender, totalAmount, monthlyPayment, startDate: date, months: count, accountId, note, receiveOnAccount: receive })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextField label="Nom" value={name} onChange={setName} placeholder="Crédit auto, conso…" />
      <TextField label="Prêteur" value={lender} onChange={setLender} placeholder="Banque, ami, société…" />
      <AmountField label="Montant encore dû" value={total} onChange={setTotal} />
      <AmountField label="Mensualité" value={monthly} onChange={setMonthly} />
      <DateField label={initial ? 'Date de départ du calendrier' : 'Prochaine échéance'} value={date} onChange={setDate} />
      <TextField label="Nombre d’échéances" value={months} onChange={setMonths} placeholder="12" />
      <SelectField label="Compte utilisé pour payer" value={accountId} onChange={(value) => setAccountId(Number(value))}>
        {visible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </SelectField>
      <TextField label="Note" value={note} onChange={setNote} />
      {!initial && (
        <CheckRow
          checked={receive}
          onChange={setReceive}
          title="Ce montant vient d’être versé sur le compte"
          detail="Coche seulement pour un crédit nouveau. Un crédit déjà en cours ne doit pas gonfler ton solde."
        />
      )}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Enregistrer</Button>
    </form>
  )
}

function PayCreditForm({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  const { accounts, creditPayments } = useMoney()
  const accountName = accounts.find((account) => account.id === credit.accountId)?.name ?? 'le compte'
  const next = nextCredit(credit, creditPayments)
  const [amount, setAmount] = useState(next ? amountToInput(next.amount) : '')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (parsed == null) {
      setError('Indique un montant supérieur à zéro.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await payCredit(credit.id, parsed, date)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <p className="mb-3 text-sm text-muted">Reste dû : {mad(creditRemaining(credit, creditPayments))}. Le paiement sort de {accountName}.</p>
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Payer</Button>
    </form>
  )
}

function BillsTab() {
  const money = useMoney()
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [pay, setPay] = useState<{ id: number; yearMonth: string } | null>(null)
  const today = todayISO()
  const current = monthKey(today)
  const editing = money.obligations.find((item) => item.id === editId) ?? null
  const active = money.obligations.filter((item) => item.active)
  const paused = money.obligations.filter((item) => !item.active)

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Loyer, téléphone, abonnements</p>
          <p className="font-serif text-2xl">Chaque mois</p>
        </div>
        <Button onClick={() => setCreating(true)}>Ajouter</Button>
      </div>
      {money.obligations.length === 0 ? (
        <Empty title="Aucune obligation" text="Ajoute ce qui revient tous les mois, puis marque-le payé le jour venu." action={<Button onClick={() => setCreating(true)}>Ajouter</Button>} />
      ) : (
        <div className="space-y-3">
          {[...active, ...paused].map((item) => (
            <BillCard key={item.id} item={item} current={current} today={today} onEdit={() => setEditId(item.id)} onPay={(yearMonth) => setPay({ id: item.id, yearMonth })} />
          ))}
        </div>
      )}
      <Sheet open={creating || editing != null} title={editing ? 'Modifier' : 'Nouvelle obligation'} onClose={() => { setCreating(false); setEditId(null) }}>
        {(creating || editing) && <BillForm key={editing?.id ?? 'new'} initial={editing ?? undefined} onClose={() => { setCreating(false); setEditId(null) }} />}
      </Sheet>
      <Sheet open={pay != null} title="Marquer payé" onClose={() => setPay(null)}>
        {pay && <PayBillForm id={pay.id} yearMonth={pay.yearMonth} onClose={() => setPay(null)} />}
      </Sheet>
    </div>
  )
}

function BillCard({ item, current, today, onEdit, onPay }: { item: Obligation; current: string; today: string; onEdit: () => void; onPay: (yearMonth: string) => void }) {
  const { obligationPayments, accounts } = useMoney()
  const months = [shiftMonth(current, -1), current]
  const account = accounts.find((row) => row.id === item.accountId)

  return (
    <article className="rounded-3xl bg-elev p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg">{item.name}</h3>
          <p className="text-xs text-muted">Le {item.dayOfMonth} · {account?.name}{item.note ? ` · ${item.note}` : ''}</p>
        </div>
        <p className="num text-xl">{mad(item.amount)}</p>
      </div>
      {!item.active && <div className="mt-2"><Pill>En pause</Pill></div>}
      <div className="mt-3 space-y-2">
        {months.map((ym) => {
          const payment = obligationPayments.find((row) => row.obligationId === item.id && row.yearMonth === ym)
          const due = obligationDueDate(item.dayOfMonth, ym)
          if (payment) {
            return (
              <div key={ym} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-good capitalize">{monthLabel(ym)} · payé</span>
                <button type="button" className="text-xs text-muted" onClick={() => { if (window.confirm('Annuler ce paiement ?')) void unpayObligation(payment.id) }}>Annuler</button>
              </div>
            )
          }
          if (!item.active) return null
          const recent = due >= addDays(today, -20)
          if (ym !== current && !recent) return null
          return (
            <div key={ym} className="flex items-center justify-between gap-2">
              <span className={due < today ? 'text-sm text-bad capitalize' : 'text-sm text-muted capitalize'}>{monthLabel(ym)}{due < today ? ' · en retard' : ''}</span>
              <Button onClick={() => onPay(ym)}>Payé</Button>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Button tone="ghost" onClick={onEdit}>Modifier</Button>
        <Button tone="danger" onClick={() => { if (window.confirm('Supprimer cette obligation et ses paiements ?')) void deleteObligation(item.id) }}>Supprimer</Button>
      </div>
    </article>
  )
}

function BillForm({ initial, onClose }: { initial?: Obligation; onClose: () => void }) {
  const { accounts, categories } = useMoney()
  const visible = openAccounts(accounts)
  const expense = openCategories(categories, 'expense')
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? amountToInput(initial.amount) : '')
  const [day, setDay] = useState(initial ? String(initial.dayOfMonth) : '1')
  const [accountId, setAccountId] = useState(initial?.accountId ?? visible[0]?.id ?? 0)
  const [categoryId, setCategoryId] = useState<number | ''>(initial?.categoryId ?? expense[0]?.id ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    const dayOfMonth = Number(day)
    if (parsed == null) {
      setError('Indique un montant supérieur à zéro.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { name, amount: parsed, accountId, categoryId: categoryId === '' ? null : categoryId, dayOfMonth, note }
      if (initial) await updateObligation(initial.id, { ...payload, active })
      else await createObligation(payload)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextField label="Nom" value={name} onChange={setName} placeholder="Loyer, internet, forfait…" />
      <AmountField value={amount} onChange={setAmount} />
      <TextField label="Jour du mois" value={day} onChange={setDay} placeholder="5" />
      <SelectField label="Compte" value={accountId} onChange={(value) => setAccountId(Number(value))}>
        {visible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </SelectField>
      <SelectField label="Catégorie" value={categoryId} onChange={(value) => setCategoryId(value ? Number(value) : '')}>
        {expense.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </SelectField>
      <TextField label="Note" value={note} onChange={setNote} />
      {initial && <CheckRow checked={active} onChange={setActive} title="Toujours active" detail="Décoche pour mettre en pause sans effacer l’historique." />}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Enregistrer</Button>
    </form>
  )
}

function PayBillForm({ id, yearMonth, onClose }: { id: number; yearMonth: string; onClose: () => void }) {
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await payObligation(id, yearMonth, date)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <p className="mb-3 text-sm text-muted capitalize">Paiement pour {monthLabel(yearMonth)}. Une dépense sera créée.</p>
      <DateField label="Date du paiement" value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Marquer payé</Button>
    </form>
  )
}
