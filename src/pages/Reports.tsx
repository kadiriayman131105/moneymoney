import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { MonthPager, PageHeader } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import { monthSeries, nouranTotals, totalsByCategory } from '../lib/calc.ts'
import { monthKey, shortMonth, todayISO } from '../lib/dates.ts'
import { mad } from '../lib/format.ts'
import { useTheme } from '../theme.tsx'

export function Reports() {
  const { transactions, categories, nouranEntries } = useMoney()
  const { theme } = useTheme()
  const [ym, setYm] = useState(monthKey(todayISO()))
  const [span, setSpan] = useState<6 | 12>(6)
  const series = monthSeries(transactions, ym, span).map((row) => ({ ...row, label: shortMonth(row.ym) }))
  const expenses = totalsByCategory(transactions, ym, 'expense')
  const incomes = totalsByCategory(transactions, ym, 'income')
  const nouran = nouranTotals(nouranEntries, ym)
  const incomeColor = theme === 'dark' ? '#e4c88a' : '#8d6a30'
  const expenseColor = theme === 'dark' ? '#f3ede3' : '#0a1f3d'
  const empty = series.every((row) => row.income === 0 && row.expense === 0)

  return (
    <div>
      <Link to="/plus" className="mb-3 inline-block text-sm text-gold">Retour</Link>
      <PageHeader
        title="Rapports"
        action={(
          <button type="button" className="rounded-full bg-soft px-3 py-1.5 text-xs" onClick={() => setSpan((value) => value === 6 ? 12 : 6)}>
            {span} mois
          </button>
        )}
      />
      <MonthPager ym={ym} onChange={setYm} />
      <section className="rounded-3xl bg-elev p-4 ring-1 ring-line">
        <div className="mb-3 flex gap-4 text-xs text-muted">
          <span className="text-good">Entrées</span>
          <span className="text-ink">Sorties de vie</span>
        </div>
        {empty ? (
          <p className="py-8 text-center text-sm text-muted">Pas encore de revenus ou de dépenses sur cette période.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={theme === 'dark' ? '#234266' : '#d3deea'} />
                <XAxis dataKey="label" tick={{ fill: theme === 'dark' ? '#a9b9cc' : '#5c7088', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? '#183252' : '#e3ebf4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-2xl bg-elev px-3 py-2 text-xs ring-1 ring-line">
                        <p className="mb-1 capitalize">{label}</p>
                        {payload.map((item) => (
                          <p key={String(item.dataKey)}>{item.name} · {mad(Number(item.value ?? 0))}</p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="income" name="Entrées" fill={incomeColor} radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Sorties" fill={expenseColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <Breakdown title="Dépenses par catégorie" rows={expenses} categories={categories} />
      <Breakdown title="Revenus par source" rows={incomes} categories={categories} />
      <section className="mt-4 rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">Nouran Parfums</h2>
        <p className="mt-2 text-sm text-muted">Bénéfice du mois</p>
        <p className={nouran.profit >= 0 ? 'num text-3xl text-good' : 'num text-3xl text-bad'}>{mad(nouran.profit)}</p>
        <p className="mt-1 text-xs text-muted">Ventes {mad(nouran.sale)} · achats {mad(nouran.purchase)} · frais {mad(nouran.fee)}</p>
      </section>
    </div>
  )
}

function Breakdown({
  title,
  rows,
  categories,
}: {
  title: string
  rows: { categoryId: number; amount: number }[]
  categories: { id: number; name: string; symbol: string }[]
}) {
  const max = rows[0]?.amount ?? 1
  return (
    <section className="mt-4 rounded-3xl bg-elev p-4 ring-1 ring-line">
      <h2 className="mb-3 font-serif text-2xl">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">Rien sur ce mois.</p>}
      <div className="space-y-3">
        {rows.map((row) => {
          const category = categories.find((item) => item.id === row.categoryId)
          return (
            <div key={row.categoryId}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{category ? `${category.symbol} ${category.name}` : 'Sans catégorie'}</span>
                <span className="num shrink-0">{mad(row.amount)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(row.amount / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
