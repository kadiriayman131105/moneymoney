import { db } from '../db.ts'

const INCOME = [
  ['Salaire', '💼'],
  ['Nouran Parfums', '🌸'],
  ['Cadeau', '🎁'],
  ['Remboursement', '↩'],
  ['Autre revenu', '＋'],
] as const

const EXPENSE = [
  ['Alimentation', '🍽'],
  ['Transport', '🚌'],
  ['Logement', '🏠'],
  ['Famille', '💛'],
  ['Santé', '✚'],
  ['Loisirs', '🎟'],
  ['Téléphone', '📱'],
  ['Shopping', '🛍'],
  ['Éducation', '📚'],
  ['Nouran Parfums', '🌸'],
  ['Autre dépense', '•'],
] as const

let seeding: Promise<void> | null = null

export function seedIfEmpty() {
  if (!seeding) {
    seeding = seedOnce().finally(() => {
      seeding = null
    })
  }
  return seeding
}

async function seedOnce() {
  await db.open()
  if ((await db.accounts.count()) > 0) return
  const now = Date.now()
  await db.transaction('rw', db.accounts, db.categories, async () => {
    if ((await db.accounts.count()) > 0) return
    await db.accounts.bulkAdd([
      { name: 'Espèces', kind: 'cash', openingBalance: 0, color: '#e4c88a', archived: false, createdAt: now },
      { name: 'Banque', kind: 'bank', openingBalance: 0, color: '#7fa3c9', archived: false, createdAt: now },
    ])
    await db.categories.bulkAdd([
      ...INCOME.map(([name, symbol]) => ({ name, symbol, kind: 'income' as const, archived: false })),
      ...EXPENSE.map(([name, symbol]) => ({ name, symbol, kind: 'expense' as const, archived: false })),
    ])
  })
}

export async function persistStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Le navigateur décide. La sauvegarde JSON reste la vraie sécurité.
  }
}
