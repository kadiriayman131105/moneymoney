import { db } from '../db.ts'
import { seedIfEmpty } from './seed.ts'
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

export interface Backup {
  version: 1
  exportedAt: string
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

export async function buildBackup(): Promise<Backup> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    obligations: await db.obligations.toArray(),
    obligationPayments: await db.obligationPayments.toArray(),
    credits: await db.credits.toArray(),
    creditPayments: await db.creditPayments.toArray(),
    personDebts: await db.personDebts.toArray(),
    personPayments: await db.personPayments.toArray(),
    nouranEntries: await db.nouranEntries.toArray(),
  }
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `moneymoney-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function parseBackup(raw: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Ce fichier n’est pas un JSON lisible.')
  }
  if (!data || typeof data !== 'object') throw new Error('Ce fichier n’est pas une sauvegarde Moneymoney.')
  const row = data as Partial<Backup>
  if (row.version !== 1) throw new Error('Cette sauvegarde vient d’une autre version.')
  if (!isArray(row.accounts) || row.accounts.length === 0) throw new Error('La sauvegarde ne contient aucun compte.')
  const keys = [
    'categories',
    'transactions',
    'obligations',
    'obligationPayments',
    'credits',
    'creditPayments',
    'personDebts',
    'personPayments',
    'nouranEntries',
  ] as const
  for (const key of keys) {
    if (!isArray(row[key])) throw new Error('Ce fichier n’est pas une sauvegarde Moneymoney.')
  }
  return row as Backup
}

export async function replaceWithBackup(backup: Backup) {
  await db.transaction('rw', [
    db.accounts,
    db.categories,
    db.transactions,
    db.obligations,
    db.obligationPayments,
    db.credits,
    db.creditPayments,
    db.personDebts,
    db.personPayments,
    db.nouranEntries,
  ], async () => {
      await db.obligationPayments.clear()
      await db.creditPayments.clear()
      await db.personPayments.clear()
      await db.transactions.clear()
      await db.obligations.clear()
      await db.credits.clear()
      await db.personDebts.clear()
      await db.nouranEntries.clear()
      await db.categories.clear()
      await db.accounts.clear()
      await db.accounts.bulkAdd(backup.accounts)
      await db.categories.bulkAdd(backup.categories)
      await db.transactions.bulkAdd(backup.transactions)
      await db.obligations.bulkAdd(backup.obligations)
      await db.obligationPayments.bulkAdd(backup.obligationPayments)
      await db.credits.bulkAdd(backup.credits)
      await db.creditPayments.bulkAdd(backup.creditPayments)
      await db.personDebts.bulkAdd(backup.personDebts)
      await db.personPayments.bulkAdd(backup.personPayments)
      await db.nouranEntries.bulkAdd(backup.nouranEntries)
    },
  )
}

export async function eraseAll() {
  await db.transaction('rw', [
    db.accounts,
    db.categories,
    db.transactions,
    db.obligations,
    db.obligationPayments,
    db.credits,
    db.creditPayments,
    db.personDebts,
    db.personPayments,
    db.nouranEntries,
  ], async () => {
      await Promise.all([
        db.obligationPayments.clear(),
        db.creditPayments.clear(),
        db.personPayments.clear(),
        db.transactions.clear(),
        db.obligations.clear(),
        db.credits.clear(),
        db.personDebts.clear(),
        db.nouranEntries.clear(),
        db.categories.clear(),
        db.accounts.clear(),
      ])
    },
  )
  await seedIfEmpty()
}
