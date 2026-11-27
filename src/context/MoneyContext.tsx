import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from '../db.ts'
import { persistStorage, seedIfEmpty } from '../lib/seed.ts'
import type {
  Account,
  Category,
  Credit,
  CreditPayment,
  NouranEntry,
  Obligation,
  ObligationPayment,
  PersonDebt,
  PersonPayment,
  Transaction,
} from '../types.ts'

export type MoneyState = {
  loaded: boolean
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  obligations: Obligation[]
  obligationPayments: ObligationPayment[]
  credits: Credit[]
  creditPayments: CreditPayment[]
  personDebts: PersonDebt[]
  personPayments: PersonPayment[]
  nouranEntries: NouranEntry[]
}

const MoneyContext = createContext<MoneyState | null>(null)

export function MoneyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    seedIfEmpty()
      .then(() => persistStorage())
      .finally(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const accounts = useLiveQuery(async () => {
    const rows = await db.accounts.toArray()
    return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'fr'))
  })
  const categories = useLiveQuery(async () => {
    const rows = await db.categories.toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  })
  const transactions = useLiveQuery(async () => {
    const rows = await db.transactions.toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  })
  const obligations = useLiveQuery(() => db.obligations.toArray())
  const obligationPayments = useLiveQuery(() => db.obligationPayments.toArray())
  const credits = useLiveQuery(() => db.credits.toArray())
  const creditPayments = useLiveQuery(() => db.creditPayments.toArray())
  const personDebts = useLiveQuery(async () => {
    const rows = await db.personDebts.toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  })
  const personPayments = useLiveQuery(() => db.personPayments.toArray())
  const nouranEntries = useLiveQuery(async () => {
    const rows = await db.nouranEntries.toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  })

  const loaded = ready
    && accounts !== undefined
    && categories !== undefined
    && transactions !== undefined
    && obligations !== undefined
    && obligationPayments !== undefined
    && credits !== undefined
    && creditPayments !== undefined
    && personDebts !== undefined
    && personPayments !== undefined
    && nouranEntries !== undefined

  const value: MoneyState = {
    loaded,
    accounts: accounts ?? [],
    categories: categories ?? [],
    transactions: transactions ?? [],
    obligations: obligations ?? [],
    obligationPayments: obligationPayments ?? [],
    credits: credits ?? [],
    creditPayments: creditPayments ?? [],
    personDebts: personDebts ?? [],
    personPayments: personPayments ?? [],
    nouranEntries: nouranEntries ?? [],
  }

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
}

export function useMoney() {
  const value = useContext(MoneyContext)
  if (!value) throw new Error('useMoney doit être utilisé dans MoneyProvider')
  return value
}
