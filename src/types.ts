export type AccountKind = 'cash' | 'bank' | 'other'
export type FlowKind = 'income' | 'expense'
export type TxType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'loanOut'
  | 'loanIn'
  | 'debtIn'
  | 'debtOut'
  | 'creditIn'
  | 'creditOut'

export type DebtDirection = 'lent' | 'owe'
export type NouranKind = 'purchase' | 'sale' | 'fee'

export interface Account {
  id: number
  name: string
  kind: AccountKind
  openingBalance: number
  color: string
  archived: boolean
  createdAt: number
}

export interface Category {
  id: number
  name: string
  kind: FlowKind
  symbol: string
  archived: boolean
}

export interface Transaction {
  id: number
  type: TxType
  amount: number
  accountId: number
  toAccountId?: number
  categoryId?: number
  date: string
  note: string
  createdAt: number
}

export interface Obligation {
  id: number
  name: string
  amount: number
  accountId: number
  categoryId?: number
  dayOfMonth: number
  active: boolean
  note: string
}

export interface ObligationPayment {
  id: number
  obligationId: number
  yearMonth: string
  transactionId: number
  paidAt: string
}

export interface Credit {
  id: number
  name: string
  lender: string
  totalAmount: number
  monthlyPayment: number
  startDate: string
  months: number
  accountId: number
  note: string
  active: boolean
  transactionId?: number
}

export interface CreditPayment {
  id: number
  creditId: number
  installment: number
  amount: number
  date: string
  transactionId: number
}

export interface PersonDebt {
  id: number
  direction: DebtDirection
  person: string
  amount: number
  date: string
  note: string
  settled: boolean
  forgiven: boolean
  transactionId?: number
}

export interface PersonPayment {
  id: number
  debtId: number
  amount: number
  date: string
  note: string
  transactionId?: number
}

export interface NouranEntry {
  id: number
  kind: NouranKind
  amount: number
  date: string
  description: string
  product: string
  quantity?: number
  accountId?: number
  transactionId?: number
}

export interface LifeTxDraft {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  accountId: number
  toAccountId: number | null
  categoryId: number | null
  date: string
  note: string
}
