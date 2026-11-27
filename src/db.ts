import Dexie, { type EntityTable } from 'dexie'
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
} from './types.ts'

export const db = new Dexie('moneymoney') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  obligations: EntityTable<Obligation, 'id'>
  obligationPayments: EntityTable<ObligationPayment, 'id'>
  credits: EntityTable<Credit, 'id'>
  creditPayments: EntityTable<CreditPayment, 'id'>
  personDebts: EntityTable<PersonDebt, 'id'>
  personPayments: EntityTable<PersonPayment, 'id'>
  nouranEntries: EntityTable<NouranEntry, 'id'>
}

db.version(1).stores({
  accounts: '++id',
  categories: '++id, kind',
  transactions: '++id, date, accountId, type',
  obligations: '++id',
  obligationPayments: '++id, obligationId, yearMonth, &[obligationId+yearMonth], transactionId',
  credits: '++id, transactionId',
  creditPayments: '++id, creditId, transactionId',
  personDebts: '++id, direction, person, transactionId',
  personPayments: '++id, debtId, transactionId',
  nouranEntries: '++id, date, kind, transactionId',
})
