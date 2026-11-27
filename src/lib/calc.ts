import type { Credit, CreditPayment, Obligation, ObligationPayment, PersonDebt, PersonPayment, Transaction } from '../types.ts'
import { addDays, addMonths, clampDay, monthKey, shiftMonth, todayISO } from './dates.ts'
import { round2 } from './format.ts'

export function effectOnAccount(tx: Transaction, accountId: number) {
  const amount = tx.amount
  switch (tx.type) {
    case 'income':
    case 'loanIn':
    case 'debtIn':
    case 'creditIn':
      return tx.accountId === accountId ? amount : 0
    case 'expense':
    case 'loanOut':
    case 'debtOut':
    case 'creditOut':
      return tx.accountId === accountId ? -amount : 0
    case 'transfer':
      if (tx.accountId === accountId) return -amount
      if (tx.toAccountId === accountId) return amount
      return 0
    default: {
      const unreachable: never = tx.type
      return unreachable
    }
  }
}

export function accountBalance(opening: number, accountId: number, transactions: Transaction[]) {
  const delta = transactions.reduce((sum, tx) => sum + effectOnAccount(tx, accountId), 0)
  return round2(opening + delta)
}

export function debtPaid(debtId: number, payments: PersonPayment[]) {
  return round2(payments.filter((p) => p.debtId === debtId).reduce((sum, p) => sum + p.amount, 0))
}

export function debtRemaining(debt: PersonDebt, payments: PersonPayment[]) {
  if (debt.settled) return 0
  return round2(Math.max(0, debt.amount - debtPaid(debt.id, payments)))
}

export function creditPaid(creditId: number, payments: CreditPayment[]) {
  return round2(payments.filter((p) => p.creditId === creditId).reduce((sum, p) => sum + p.amount, 0))
}

export function creditRemaining(credit: Credit, payments: CreditPayment[]) {
  return round2(Math.max(0, credit.totalAmount - creditPaid(credit.id, payments)))
}

export function obligationDueDate(dayOfMonth: number, ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return clampDay(y, (m ?? 1) - 1, dayOfMonth)
}

export type Upcoming = {
  key: string
  date: string
  title: string
  subtitle: string
  amount: number
  overdue: boolean
}

export function upcoming(
  obligations: Obligation[],
  obligationPayments: ObligationPayment[],
  credits: Credit[],
  creditPayments: CreditPayment[],
  today = todayISO(),
): Upcoming[] {
  const end = addDays(today, 30)
  const start = addDays(today, -45)
  const items: Upcoming[] = []
  const months = [shiftMonth(monthKey(today), -1), monthKey(today), shiftMonth(monthKey(today), 1)]

  for (const ob of obligations) {
    if (!ob.active) continue
    for (const ym of months) {
      const paid = obligationPayments.some((p) => p.obligationId === ob.id && p.yearMonth === ym)
      if (paid) continue
      const date = obligationDueDate(ob.dayOfMonth, ym)
      if (date < start || date > end) continue
      items.push({
        key: `ob-${ob.id}-${ym}`,
        date,
        title: ob.name,
        subtitle: 'Obligation',
        amount: ob.amount,
        overdue: date < today,
      })
    }
  }

  for (const credit of credits) {
    const next = nextCredit(credit, creditPayments, today)
    if (!next || next.date > end) continue
    items.push({
      key: `cr-${credit.id}-${next.installment}`,
      date: next.date,
      title: credit.name,
      subtitle: credit.lender ? `Crédit · ${credit.lender}` : 'Crédit',
      amount: next.amount,
      overdue: next.date < today,
    })
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'))
}

export function nextCredit(credit: Credit, payments: CreditPayment[], today = todayISO()) {
  const remaining = creditRemaining(credit, payments)
  if (remaining <= 0) return null
  const used = new Set(payments.filter((p) => p.creditId === credit.id).map((p) => p.installment))
  let installment = 1
  while (used.has(installment)) installment += 1
  const date = installment <= credit.months ? addMonths(credit.startDate, installment - 1) : today
  return {
    installment,
    date,
    amount: round2(Math.min(credit.monthlyPayment, remaining)),
    remaining,
  }
}

export function monthFinance(transactions: Transaction[], ym: string) {
  let incoming = 0
  let outgoing = 0
  for (const tx of transactions) {
    if (!tx.date.startsWith(ym)) continue
    if (tx.type === 'loanIn' || tx.type === 'debtIn' || tx.type === 'creditIn') incoming += tx.amount
    if (tx.type === 'loanOut' || tx.type === 'debtOut' || tx.type === 'creditOut') outgoing += tx.amount
  }
  return { incoming: round2(incoming), outgoing: round2(outgoing) }
}

export function monthFlow(transactions: Transaction[], ym: string) {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    if (!tx.date.startsWith(ym)) continue
    if (tx.type === 'income') income += tx.amount
    if (tx.type === 'expense') expense += tx.amount
  }
  return { income: round2(income), expense: round2(expense) }
}

export function monthSeries(transactions: Transaction[], endYm: string, count: number) {
  const rows = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const ym = shiftMonth(endYm, -i)
    rows.push({ ym, ...monthFlow(transactions, ym) })
  }
  return rows
}

export function totalsByCategory(
  transactions: Transaction[],
  ym: string,
  kind: 'income' | 'expense',
) {
  const map = new Map<number, number>()
  for (const tx of transactions) {
    if (tx.type !== kind || tx.categoryId == null || !tx.date.startsWith(ym)) continue
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount)
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
}

export function nouranTotals(entries: { kind: 'purchase' | 'sale' | 'fee'; amount: number; date: string }[], ym?: string) {
  const list = ym ? entries.filter((e) => e.date.startsWith(ym)) : entries
  const sale = round2(list.filter((e) => e.kind === 'sale').reduce((s, e) => s + e.amount, 0))
  const purchase = round2(list.filter((e) => e.kind === 'purchase').reduce((s, e) => s + e.amount, 0))
  const fee = round2(list.filter((e) => e.kind === 'fee').reduce((s, e) => s + e.amount, 0))
  return { sale, purchase, fee, profit: round2(sale - purchase - fee) }
}
