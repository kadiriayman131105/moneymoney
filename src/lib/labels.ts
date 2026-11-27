import type { Account, Category, Transaction, TxType } from '../types.ts'

const TITLES: Record<TxType, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  transfer: 'Virement',
  loanOut: 'Prêt accordé',
  loanIn: 'Remboursement reçu',
  debtIn: 'Argent emprunté',
  debtOut: 'Dette remboursée',
  creditIn: 'Capital reçu',
  creditOut: 'Échéance de crédit',
}

export function txDirection(tx: Transaction): -1 | 0 | 1 {
  switch (tx.type) {
    case 'income':
    case 'loanIn':
    case 'debtIn':
    case 'creditIn':
      return 1
    case 'transfer':
      return 0
    case 'expense':
    case 'loanOut':
    case 'debtOut':
    case 'creditOut':
      return -1
    default: {
      const unreachable: never = tx.type
      return unreachable
    }
  }
}

export function txTitle(tx: Transaction, categories: Category[], accounts: Account[]) {
  if (tx.type === 'income' || tx.type === 'expense') {
    return categories.find((c) => c.id === tx.categoryId)?.name ?? TITLES[tx.type]
  }
  if (tx.type === 'transfer') {
    const to = accounts.find((a) => a.id === tx.toAccountId)
    return to ? `Vers ${to.name}` : 'Virement'
  }
  return TITLES[tx.type]
}

export function txSymbol(tx: Transaction, categories: Category[]) {
  if ((tx.type === 'income' || tx.type === 'expense') && tx.categoryId != null) {
    return categories.find((c) => c.id === tx.categoryId)?.symbol ?? '•'
  }
  if (tx.type === 'transfer') return '⇄'
  if (tx.type === 'loanOut' || tx.type === 'loanIn') return '🤝'
  if (tx.type === 'debtIn' || tx.type === 'debtOut') return '↩'
  return '🏦'
}

export function accountKindLabel(kind: Account['kind']) {
  if (kind === 'cash') return 'Espèces'
  if (kind === 'bank') return 'Banque'
  return 'Autre'
}

export function isLifeType(type: TxType): type is 'income' | 'expense' | 'transfer' {
  return type === 'income' || type === 'expense' || type === 'transfer'
}

export function openAccounts(accounts: Account[]) {
  return accounts.filter((a) => !a.archived)
}

export function openCategories(categories: Category[], kind: 'income' | 'expense') {
  return categories.filter((c) => c.kind === kind && !c.archived).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
