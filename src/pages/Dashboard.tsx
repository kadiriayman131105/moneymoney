import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconTheme } from '../components/icons.tsx'
import { useQuickAdd } from '../components/QuickAdd.tsx'
import { AmountField, Button, ErrorText, MoneyText, Sheet } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import { saveAccount } from '../lib/actions.ts'
import { accountBalance, creditRemaining, debtRemaining, monthFinance, monthFlow, upcoming } from '../lib/calc.ts'
import { dayLabel, greeting, monthKey, monthLabel, shortDate, todayISO } from '../lib/dates.ts'
import { amountToInput, errorMessage, mad, parseAmount, round2 } from '../lib/format.ts'
import { useTheme } from '../theme.tsx'

export function Dashboard() {
  const { accounts, transactions, obligations, obligationPayments, credits, creditPayments, personDebts, personPayments } = useMoney()
  const open = useQuickAdd()
  const { toggle, theme } = useTheme()
  const [balancesOpen, setBalancesOpen] = useState(false)
  const [openingHidden, setOpeningHidden] = useState(() => localStorage.getItem('mm-hide-opening') === '1')
  const [installHidden, setInstallHidden] = useState(() => localStorage.getItem('mm-hide-install') === '1')
  const today = todayISO()
  const ym = monthKey(today)
  const balances = accounts.map((account) => ({
    account,
    balance: accountBalance(account.openingBalance, account.id, transactions),
  }))
  const accountsTotal = round2(balances.reduce((sum, row) => sum + row.balance, 0))
  const lent = round2(personDebts.filter((debt) => debt.direction === 'lent').reduce((sum, debt) => sum + debtRemaining(debt, personPayments), 0))
  const owe = round2(personDebts.filter((debt) => debt.direction === 'owe').reduce((sum, debt) => sum + debtRemaining(debt, personPayments), 0))
  const creditsLeft = round2(credits.reduce((sum, credit) => sum + creditRemaining(credit, creditPayments), 0))
  const net = round2(accountsTotal + lent - owe - creditsLeft)
  const flow = monthFlow(transactions, ym)
  const finance = monthFinance(transactions, ym)
  const soon = upcoming(obligations, obligationPayments, credits, creditPayments, today).slice(0, 6)
  const monthSpan = flow.income + flow.expense
  const incomeShare = monthSpan === 0 ? 0 : (flow.income / monthSpan) * 100
  const showBalances = balances.filter((row) => !row.account.archived || row.balance !== 0)
  const needsOpening = !openingHidden && transactions.length === 0 && accounts.every((account) => account.openingBalance === 0)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted capitalize">{dayLabel(today)}</p>
          <h1 className="font-serif text-4xl leading-none tracking-tight">{greeting()}</h1>
        </div>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-soft" onClick={toggle} aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}>
          <IconTheme />
        </button>
      </header>

      <section className="hero-card rounded-[28px] p-5">
        <p className="text-sm text-muted">Patrimoine net</p>
        <p className="num hero-figure mt-1 text-[2.7rem] leading-none">{mad(net)}</p>
        <p className="mt-2 text-xs text-muted">Comptes + ce qu’on te doit − dettes − crédits. Uniquement sur cet appareil.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Mini label="Comptes" value={accountsTotal} />
          <Mini label="On me doit" value={lent} />
          <Mini label="Je dois" value={round2(owe + creditsLeft)} />
        </div>
      </section>

      {needsOpening && (
        <section className="mt-4 rounded-3xl bg-elev p-4 ring-1 ring-line">
          <p className="font-serif text-2xl">Pars de tes vrais soldes</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">Indique ce que tu as aujourd’hui en espèces et en banque. Les opérations viendront ensuite.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setBalancesOpen(true)}>Entrer les soldes</Button>
            <Button tone="ghost" onClick={() => { localStorage.setItem('mm-hide-opening', '1'); setOpeningHidden(true) }}>Plus tard</Button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-2xl capitalize">{monthLabel(ym)}</h2>
          <Link to="/rapports" className="text-sm text-gold">Rapports</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <article className="rounded-3xl bg-elev p-4 ring-1 ring-line">
            <p className="text-xs text-muted">Entrées</p>
            <p className="num mt-1 text-2xl text-good">{mad(flow.income)}</p>
          </article>
          <article className="rounded-3xl bg-elev p-4 ring-1 ring-line">
            <p className="text-xs text-muted">Sorties de vie</p>
            <p className="num mt-1 text-2xl text-bad">{mad(flow.expense)}</p>
          </article>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft">
          <div className="h-full bg-good" style={{ width: `${incomeShare}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          Solde du mois <MoneyText value={round2(flow.income - flow.expense)} className={flow.income - flow.expense >= 0 ? 'text-good' : 'text-bad'} />
        </p>
        {(finance.incoming > 0 || finance.outgoing > 0) && (
          <p className="mt-1 text-xs leading-relaxed text-muted">
            À part : {mad(finance.incoming)} sont rentrés et {mad(finance.outgoing)} sont sortis pour des prêts, dettes ou crédits. Ce n’est pas du salaire, ni une dépense de vie.
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button tone="ghost" onClick={() => open({ type: 'income', categoryName: 'Salaire' })}>Salaire</Button>
          <Button tone="ghost" onClick={() => open({ type: 'expense' })}>Dépense</Button>
          <Button tone="ghost" onClick={() => open({ type: 'income', categoryName: 'Cadeau' })}>Cadeau</Button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-serif text-2xl">Comptes</h2>
        <div className="overflow-hidden rounded-3xl bg-elev ring-1 ring-line">
          {showBalances.map((row) => (
            <Link key={row.account.id} to={`/mouvements?compte=${row.account.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span className="h-3 w-3 rounded-full" style={{ background: row.account.color }} />
              <span className="min-w-0 flex-1 truncate">{row.account.name}</span>
              <span className="num text-sm">{mad(row.balance)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-serif text-2xl">À venir</h2>
          <Link to="/engagements" className="text-sm text-gold">Tout voir</Link>
        </div>
        {soon.length === 0 ? (
          <p className="rounded-3xl bg-elev px-4 py-5 text-sm text-muted ring-1 ring-line">Rien à payer sur les 30 prochains jours.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-elev ring-1 ring-line">
            {soon.map((item) => (
              <div key={item.key} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.title}</p>
                  <p className="text-xs text-muted">{item.overdue ? 'En retard · ' : ''}{shortDate(item.date)} · {item.subtitle}</p>
                </div>
                <span className={item.overdue ? 'num text-sm text-bad' : 'num text-sm'}>{mad(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">D’où vient le chiffre</h2>
        <Line label="Comptes" value={accountsTotal} />
        <Line label="On me doit" value={lent} />
        <Line label="Dettes personnelles" value={-owe} />
        <Line label="Crédits restants" value={-creditsLeft} />
      </section>

      {!standalone && !installHidden && (
        <section className="mt-6 rounded-3xl bg-elev p-4 ring-1 ring-line">
          <h2 className="font-serif text-2xl">Sur l’iPhone</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-muted">
            <li>Ouvre cette adresse dans Safari.</li>
            <li>Appuie sur Partager.</li>
            <li>Choisis Sur l’écran d’accueil.</li>
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-muted">Il faut une adresse https. En local, lance l’app puis mets-la en ligne. Tes chiffres ne quittent pas le téléphone.</p>
          <button type="button" className="mt-3 text-sm text-gold" onClick={() => { localStorage.setItem('mm-hide-install', '1'); setInstallHidden(true) }}>Masquer</button>
        </section>
      )}

      <OpeningSheet open={balancesOpen} onClose={() => setBalancesOpen(false)} onSaved={() => setOpeningHidden(true)} />
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num text-sm">{mad(value)}</p>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="num text-sm">{mad(value)}</span>
    </div>
  )
}

function OpeningSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { accounts } = useMoney()
  const active = accounts.filter((account) => !account.archived)
  const [values, setValues] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      for (const account of active) {
        const raw = values[account.id] ?? amountToInput(account.openingBalance)
        const amount = parseAmount(raw, { allowZero: true, allowNegative: true })
        if (amount == null) throw new Error(`Solde invalide pour ${account.name}.`)
        await saveAccount({ id: account.id, name: account.name, kind: account.kind, openingBalance: amount, color: account.color })
      }
      localStorage.setItem('mm-hide-opening', '1')
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Soldes de départ" onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-muted">Ce que tu as maintenant, avant les opérations que tu vas noter ici.</p>
      {active.map((account) => (
        <AmountField
          key={account.id}
          label={account.name}
          value={values[account.id] ?? ''}
          onChange={(value) => setValues((current) => ({ ...current, [account.id]: value }))}
        />
      ))}
      <ErrorText>{error}</ErrorText>
      <Button className="w-full" disabled={saving} onClick={() => void save()}>Enregistrer</Button>
    </Sheet>
  )
}
