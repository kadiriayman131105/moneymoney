import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuickAdd } from '../components/QuickAdd.tsx'
import { TransactionForm } from '../components/TransactionForm.tsx'
import { Button, Empty, fieldClass, MonthPager, PageHeader, Sheet } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import { deleteTransaction, updateLifeTransaction } from '../lib/actions.ts'
import { dayLabel, monthKey, todayISO } from '../lib/dates.ts'
import { errorMessage, madSigned } from '../lib/format.ts'
import { isLifeType, txDirection, txSymbol, txTitle } from '../lib/labels.ts'
import type { Transaction, TxType } from '../types.ts'

type Filter = 'all' | 'income' | 'expense' | 'transfer' | 'finance'

export function Transactions() {
  const { transactions, categories, accounts } = useMoney()
  const open = useQuickAdd()
  const [params] = useSearchParams()
  const accountId = Number(params.get('compte')) || null
  const [ym, setYm] = useState(monthKey(todayISO()))
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const account = accounts.find((item) => item.id === accountId)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (!tx.date.startsWith(ym)) return false
      if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) return false
      if (!matches(tx.type, filter)) return false
      if (!needle) return true
      const title = txTitle(tx, categories, accounts).toLowerCase()
      return title.includes(needle) || tx.note.toLowerCase().includes(needle) || String(tx.amount).includes(needle)
    })
  }, [transactions, ym, accountId, filter, query, categories, accounts])

  const groups = new Map<string, Transaction[]>()
  for (const tx of rows) {
    const list = groups.get(tx.date) ?? []
    list.push(tx)
    groups.set(tx.date, list)
  }

  return (
    <div>
      <PageHeader title="Mouvements" action={<Button tone="ghost" onClick={() => open()}>Ajouter</Button>} />
      <MonthPager ym={ym} onChange={setYm} />
      {account && (
        <p className="mb-3 text-sm text-muted">
          Compte : {account.name}{' '}
          <Link to="/mouvements" className="text-gold">Tout voir</Link>
        </p>
      )}
      <input className={`${fieldClass} mb-3`} value={query} placeholder="Rechercher" onChange={(event) => setQuery(event.target.value)} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {([
          ['all', 'Tout'],
          ['income', 'Revenus'],
          ['expense', 'Dépenses'],
          ['transfer', 'Virements'],
          ['finance', 'Prêts & crédits'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'shrink-0 rounded-full bg-gold px-3 py-1.5 text-xs text-on' : 'shrink-0 rounded-full bg-soft px-3 py-1.5 text-xs text-muted'} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title="Rien ce mois-ci" text="Ajoute un salaire, une dépense, un cadeau ou un virement." action={<Button onClick={() => open()}>Ajouter</Button>} />
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-1 text-xs tracking-wide text-muted capitalize">{dayLabel(date)}</h2>
              <div className="overflow-hidden rounded-3xl bg-elev ring-1 ring-line">
                {list.map((tx) => {
                  const direction = accountId && tx.type === 'transfer'
                    ? tx.accountId === accountId ? -1 : 1
                    : txDirection(tx)
                  return (
                    <button key={tx.id} type="button" className="flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left last:border-b-0" onClick={() => setSelected(tx)}>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-soft text-lg">{txSymbol(tx, categories)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{txTitle(tx, categories, accounts)}</span>
                        <span className="block truncate text-xs text-muted">{tx.note || accounts.find((item) => item.id === tx.accountId)?.name}</span>
                      </span>
                      <span className={direction > 0 ? 'num shrink-0 text-sm text-good' : direction < 0 ? 'num shrink-0 text-sm text-bad' : 'num shrink-0 text-sm text-muted'}>
                        {madSigned(tx.amount, direction)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <Sheet open={selected != null} title="Opération" onClose={() => setSelected(null)}>
        {selected && isLifeType(selected.type) && (
          <TransactionForm
            key={selected.id}
            initial={selected}
            submitLabel="Mettre à jour"
            onSubmit={async (draft) => {
              await updateLifeTransaction(selected.id, draft)
              setSelected(null)
            }}
          />
        )}
        {selected && !isLifeType(selected.type) && (
          <p className="mb-3 text-sm leading-relaxed text-muted">Cette opération vient d’un prêt, d’une dette, d’un crédit ou de Nouran. Tu peux la supprimer ici, ou la gérer dans son écran.</p>
        )}
        {selected && (
          <Button
            tone="danger"
            className="mt-3 w-full"
            onClick={() => {
              if (!window.confirm('Supprimer cette opération ?')) return
              void deleteTransaction(selected.id).catch((error: unknown) => window.alert(errorMessage(error)))
              setSelected(null)
            }}
          >
            Supprimer
          </Button>
        )}
      </Sheet>
    </div>
  )
}

function matches(type: TxType, filter: Filter) {
  if (filter === 'all') return true
  if (filter === 'income') return type === 'income'
  if (filter === 'expense') return type === 'expense'
  if (filter === 'transfer') return type === 'transfer'
  return type !== 'income' && type !== 'expense' && type !== 'transfer'
}
