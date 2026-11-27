import Dexie from 'dexie'
import { db } from '../db.ts'
import type { AccountKind, DebtDirection, LifeTxDraft, NouranKind } from '../types.ts'
import { isISODate } from './dates.ts'
import { round2 } from './format.ts'

function cleanName(value: string, label: string) {
  const name = value.trim()
  if (!name) throw new Error(`${label} est obligatoire.`)
  if (name.length > 80) throw new Error(`${label} est trop long.`)
  return name
}

function cleanNote(value: string) {
  const note = value.trim()
  if (note.length > 500) throw new Error('La note est trop longue.')
  return note
}

function assertDate(date: string) {
  if (!isISODate(date)) throw new Error('La date n’est pas valide.')
}

function assertMoney(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Indique un montant supérieur à zéro.')
}

function assertDay(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Le jour doit être entre 1 et 31.')
}

function isConstraint(error: unknown) {
  return error instanceof Dexie.ConstraintError || (error instanceof Error && error.name === 'ConstraintError')
}

async function refreshDebt(debtId: number) {
  const debt = await db.personDebts.get(debtId)
  if (!debt || debt.forgiven) return
  const payments = await db.personPayments.where('debtId').equals(debtId).toArray()
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const settled = paid >= debt.amount - 0.009
  if (debt.settled !== settled) await db.personDebts.update(debtId, { settled })
}

async function refreshCredit(creditId: number) {
  const credit = await db.credits.get(creditId)
  if (!credit) return
  const payments = await db.creditPayments.where('creditId').equals(creditId).toArray()
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const done = paid >= credit.totalAmount - 0.009
  if (credit.active === done) await db.credits.update(creditId, { active: !done })
}

export async function saveAccount(input: {
  id?: number
  name: string
  kind: AccountKind
  openingBalance: number
  color: string
}) {
  const name = cleanName(input.name, 'Le nom')
  if (!Number.isFinite(input.openingBalance)) throw new Error('Le solde de départ n’est pas valide.')
  const openingBalance = round2(input.openingBalance)
  if (input.id) {
    await db.accounts.update(input.id, { name, kind: input.kind, openingBalance, color: input.color })
    return
  }
  await db.accounts.add({
    name,
    kind: input.kind,
    openingBalance,
    color: input.color,
    archived: false,
    createdAt: Date.now(),
  })
}

export async function setAccountArchived(id: number, archived: boolean) {
  if (archived) {
    const others = await db.accounts.filter((account) => !account.archived && account.id !== id).count()
    if (others === 0) throw new Error('Garde au moins un compte actif.')
  }
  await db.accounts.update(id, { archived })
}

export async function deleteAccount(id: number) {
  const used = await db.transactions.filter((tx) => tx.accountId === id || tx.toAccountId === id).count()
  if (used > 0) throw new Error('Ce compte a des opérations. Archive-le à la place.')
  const obligations = await db.obligations.filter((item) => item.accountId === id).count()
  const credits = await db.credits.filter((item) => item.accountId === id).count()
  if (obligations + credits > 0) throw new Error('Ce compte est utilisé par un crédit ou une obligation.')
  const others = await db.accounts.filter((account) => account.id !== id).count()
  if (others === 0) throw new Error('Garde au moins un compte.')
  await db.accounts.delete(id)
}

export async function saveCategory(name: string, kind: 'income' | 'expense') {
  const clean = cleanName(name, 'Le nom')
  const existing = await db.categories.filter((category) => category.kind === kind && category.name.toLowerCase() === clean.toLowerCase()).first()
  if (existing) {
    if (existing.archived) {
      await db.categories.update(existing.id, { archived: false })
      return
    }
    throw new Error('Cette catégorie existe déjà.')
  }
  await db.categories.add({
    name: clean,
    kind,
    symbol: clean.slice(0, 1).toUpperCase(),
    archived: false,
  })
}

export async function renameCategory(id: number, name: string) {
  const clean = cleanName(name, 'Le nom')
  const current = await db.categories.get(id)
  if (!current) return
  const clash = await db.categories
    .filter((category) => category.id !== id && category.kind === current.kind && category.name.toLowerCase() === clean.toLowerCase())
    .first()
  if (clash) throw new Error('Cette catégorie existe déjà.')
  await db.categories.update(id, { name: clean })
}

export async function setCategoryArchived(id: number, archived: boolean) {
  await db.categories.update(id, { archived })
}

export async function createLifeTransaction(draft: LifeTxDraft) {
  assertMoney(draft.amount)
  assertDate(draft.date)
  const note = cleanNote(draft.note)
  if (draft.type === 'transfer') {
    if (draft.toAccountId == null) throw new Error('Choisis le compte de destination.')
    if (draft.toAccountId === draft.accountId) throw new Error('Choisis deux comptes différents.')
  } else if (draft.categoryId == null) {
    throw new Error('Choisis une catégorie.')
  }
  await db.transactions.add({
    type: draft.type,
    amount: draft.amount,
    accountId: draft.accountId,
    date: draft.date,
    note,
    createdAt: Date.now(),
    ...(draft.type === 'transfer' && draft.toAccountId != null ? { toAccountId: draft.toAccountId } : {}),
    ...(draft.type !== 'transfer' && draft.categoryId != null ? { categoryId: draft.categoryId } : {}),
  })
}

export async function updateLifeTransaction(id: number, draft: LifeTxDraft) {
  const existing = await db.transactions.get(id)
  if (!existing) return
  if (existing.type !== 'income' && existing.type !== 'expense' && existing.type !== 'transfer') {
    throw new Error('Cette opération se modifie depuis Engagements ou Nouran.')
  }
  assertMoney(draft.amount)
  assertDate(draft.date)
  const note = cleanNote(draft.note)
  if (draft.type === 'transfer') {
    if (draft.toAccountId == null) throw new Error('Choisis le compte de destination.')
    if (draft.toAccountId === draft.accountId) throw new Error('Choisis deux comptes différents.')
  } else if (draft.categoryId == null) {
    throw new Error('Choisis une catégorie.')
  }
  await db.transactions.where('id').equals(id).modify((row) => {
    row.type = draft.type
    row.amount = draft.amount
    row.accountId = draft.accountId
    row.date = draft.date
    row.note = note
    if (draft.type === 'transfer') {
      row.toAccountId = draft.toAccountId ?? undefined
      delete row.categoryId
    } else {
      delete row.toAccountId
      if (draft.categoryId != null) row.categoryId = draft.categoryId
    }
  })
}

export async function deleteTransaction(id: number) {
  await db.transaction('rw', [
    db.transactions,
    db.obligationPayments,
    db.creditPayments,
    db.credits,
    db.personPayments,
    db.personDebts,
    db.nouranEntries,
  ], async () => {
      const personPay = await db.personPayments.where('transactionId').equals(id).first()
      const creditPay = await db.creditPayments.where('transactionId').equals(id).first()
      const obligationPay = await db.obligationPayments.where('transactionId').equals(id).first()
      if (personPay) await db.personPayments.delete(personPay.id)
      if (creditPay) await db.creditPayments.delete(creditPay.id)
      if (obligationPay) await db.obligationPayments.delete(obligationPay.id)
      await db.personDebts.where('transactionId').equals(id).modify((row) => {
        delete row.transactionId
      })
      await db.credits.where('transactionId').equals(id).modify((row) => {
        delete row.transactionId
      })
      await db.nouranEntries.where('transactionId').equals(id).modify((row) => {
        delete row.transactionId
        delete row.accountId
      })
      await db.transactions.delete(id)
      if (personPay) await refreshDebt(personPay.debtId)
      if (creditPay) await refreshCredit(creditPay.creditId)
    },
  )
}

export async function createPersonDebt(input: {
  direction: DebtDirection
  person: string
  amount: number
  date: string
  note: string
  accountId: number | null
}) {
  const person = cleanName(input.person, 'Le nom')
  assertMoney(input.amount)
  assertDate(input.date)
  const note = cleanNote(input.note)
  await db.transaction('rw', db.personDebts, db.transactions, async () => {
    let transactionId: number | undefined
    if (input.accountId != null) {
      transactionId = await db.transactions.add({
        type: input.direction === 'lent' ? 'loanOut' : 'debtIn',
        amount: input.amount,
        accountId: input.accountId,
        date: input.date,
        note: note || person,
        createdAt: Date.now(),
      })
    }
    await db.personDebts.add({
      direction: input.direction,
      person,
      amount: input.amount,
      date: input.date,
      note,
      settled: false,
      forgiven: false,
      ...(transactionId != null ? { transactionId } : {}),
    })
  })
}

export async function updatePersonDebt(id: number, input: { person: string; amount: number; date: string; note: string }) {
  const person = cleanName(input.person, 'Le nom')
  assertMoney(input.amount)
  assertDate(input.date)
  const note = cleanNote(input.note)
  await db.transaction('rw', db.personDebts, db.personPayments, db.transactions, async () => {
    const debt = await db.personDebts.get(id)
    if (!debt) return
    const payments = await db.personPayments.where('debtId').equals(id).toArray()
    const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
    if (input.amount + 0.001 < paid) throw new Error('Le montant ne peut pas être plus petit que ce qui est déjà remboursé.')
    await db.personDebts.update(id, { person, amount: input.amount, date: input.date, note })
    if (debt.transactionId != null) {
      await db.transactions.update(debt.transactionId, {
        amount: input.amount,
        date: input.date,
        note: note || person,
      })
    }
    await refreshDebt(id)
  })
}

export async function addPersonPayment(input: {
  debtId: number
  amount: number
  date: string
  note: string
  accountId: number | null
}) {
  assertMoney(input.amount)
  assertDate(input.date)
  const note = cleanNote(input.note)
  await db.transaction('rw', db.personDebts, db.personPayments, db.transactions, async () => {
    const debt = await db.personDebts.get(input.debtId)
    if (!debt) throw new Error('Introuvable.')
    if (debt.settled) throw new Error('C’est déjà soldé.')
    const payments = await db.personPayments.where('debtId').equals(debt.id).toArray()
    const remaining = round2(debt.amount - payments.reduce((sum, payment) => sum + payment.amount, 0))
    if (input.amount - remaining > 0.001) {
      throw new Error(`Il reste ${remaining.toFixed(2).replace('.', ',')} DH.`)
    }
    let transactionId: number | undefined
    if (input.accountId != null) {
      transactionId = await db.transactions.add({
        type: debt.direction === 'lent' ? 'loanIn' : 'debtOut',
        amount: input.amount,
        accountId: input.accountId,
        date: input.date,
        note: note || debt.person,
        createdAt: Date.now(),
      })
    }
    await db.personPayments.add({
      debtId: debt.id,
      amount: input.amount,
      date: input.date,
      note,
      ...(transactionId != null ? { transactionId } : {}),
    })
    await refreshDebt(debt.id)
  })
}

export async function deletePersonPayment(id: number) {
  await db.transaction('rw', db.personPayments, db.personDebts, db.transactions, async () => {
    const payment = await db.personPayments.get(id)
    if (!payment) return
    await db.personPayments.delete(id)
    if (payment.transactionId != null) await db.transactions.delete(payment.transactionId)
    await db.personDebts.update(payment.debtId, { forgiven: false })
    await refreshDebt(payment.debtId)
  })
}

export async function forgiveDebt(id: number) {
  await db.personDebts.update(id, { settled: true, forgiven: true })
}

export async function reopenDebt(id: number) {
  await db.personDebts.update(id, { forgiven: false, settled: false })
  await refreshDebt(id)
}

export async function deletePersonDebt(id: number) {
  await db.transaction('rw', db.personDebts, db.personPayments, db.transactions, async () => {
    const debt = await db.personDebts.get(id)
    if (!debt) return
    const payments = await db.personPayments.where('debtId').equals(id).toArray()
    const txIds = [debt.transactionId, ...payments.map((payment) => payment.transactionId)].filter((txId): txId is number => txId != null)
    await db.personPayments.where('debtId').equals(id).delete()
    if (txIds.length) await db.transactions.bulkDelete(txIds)
    await db.personDebts.delete(id)
  })
}

export async function createObligation(input: {
  name: string
  amount: number
  accountId: number
  categoryId: number | null
  dayOfMonth: number
  note: string
}) {
  const name = cleanName(input.name, 'Le nom')
  assertMoney(input.amount)
  assertDay(input.dayOfMonth)
  await db.obligations.add({
    name,
    amount: input.amount,
    accountId: input.accountId,
    dayOfMonth: input.dayOfMonth,
    active: true,
    note: cleanNote(input.note),
    ...(input.categoryId != null ? { categoryId: input.categoryId } : {}),
  })
}

export async function updateObligation(id: number, input: {
  name: string
  amount: number
  accountId: number
  categoryId: number | null
  dayOfMonth: number
  note: string
  active: boolean
}) {
  const name = cleanName(input.name, 'Le nom')
  assertMoney(input.amount)
  assertDay(input.dayOfMonth)
  await db.obligations.where('id').equals(id).modify((row) => {
    row.name = name
    row.amount = input.amount
    row.accountId = input.accountId
    row.dayOfMonth = input.dayOfMonth
    row.note = cleanNote(input.note)
    row.active = input.active
    if (input.categoryId != null) row.categoryId = input.categoryId
    else delete row.categoryId
  })
}

export async function payObligation(id: number, yearMonth: string, date: string) {
  assertDate(date)
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new Error('Mois invalide.')
  try {
    await db.transaction('rw', db.obligations, db.obligationPayments, db.transactions, async () => {
      const obligation = await db.obligations.get(id)
      if (!obligation) throw new Error('Introuvable.')
      const txId = await db.transactions.add({
        type: 'expense',
        amount: obligation.amount,
        accountId: obligation.accountId,
        date,
        note: obligation.name,
        createdAt: Date.now(),
        ...(obligation.categoryId != null ? { categoryId: obligation.categoryId } : {}),
      })
      await db.obligationPayments.add({
        obligationId: obligation.id,
        yearMonth,
        transactionId: txId,
        paidAt: date,
      })
    })
  } catch (error) {
    if (isConstraint(error)) throw new Error('Déjà marquée payée pour ce mois.')
    throw error
  }
}

export async function unpayObligation(paymentId: number) {
  await db.transaction('rw', db.obligationPayments, db.transactions, async () => {
    const payment = await db.obligationPayments.get(paymentId)
    if (!payment) return
    await db.obligationPayments.delete(paymentId)
    await db.transactions.delete(payment.transactionId)
  })
}

export async function deleteObligation(id: number) {
  await db.transaction('rw', db.obligations, db.obligationPayments, db.transactions, async () => {
    const payments = await db.obligationPayments.where('obligationId').equals(id).toArray()
    if (payments.length) await db.transactions.bulkDelete(payments.map((payment) => payment.transactionId))
    await db.obligationPayments.where('obligationId').equals(id).delete()
    await db.obligations.delete(id)
  })
}

export async function createCredit(input: {
  name: string
  lender: string
  totalAmount: number
  monthlyPayment: number
  startDate: string
  months: number
  accountId: number
  note: string
  receiveOnAccount: boolean
}) {
  const name = cleanName(input.name, 'Le nom')
  const lender = input.lender.trim()
  if (lender.length > 80) throw new Error('Le prêteur est trop long.')
  assertMoney(input.totalAmount)
  assertMoney(input.monthlyPayment)
  assertDate(input.startDate)
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 600) {
    throw new Error('Indique un nombre d’échéances entre 1 et 600.')
  }
  const note = cleanNote(input.note)
  await db.transaction('rw', db.credits, db.transactions, async () => {
    let transactionId: number | undefined
    if (input.receiveOnAccount) {
      transactionId = await db.transactions.add({
        type: 'creditIn',
        amount: input.totalAmount,
        accountId: input.accountId,
        date: input.startDate,
        note: note || name,
        createdAt: Date.now(),
      })
    }
    await db.credits.add({
      name,
      lender,
      totalAmount: input.totalAmount,
      monthlyPayment: input.monthlyPayment,
      startDate: input.startDate,
      months: input.months,
      accountId: input.accountId,
      note,
      active: true,
      ...(transactionId != null ? { transactionId } : {}),
    })
  })
}

export async function updateCredit(
  id: number,
  input: {
    name: string
    lender: string
    totalAmount: number
    monthlyPayment: number
    startDate: string
    months: number
    accountId: number
    note: string
  },
) {
  const name = cleanName(input.name, 'Le nom')
  const lender = input.lender.trim()
  assertMoney(input.totalAmount)
  assertMoney(input.monthlyPayment)
  assertDate(input.startDate)
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 600) {
    throw new Error('Indique un nombre d’échéances entre 1 et 600.')
  }
  const note = cleanNote(input.note)
  await db.transaction('rw', db.credits, db.creditPayments, db.transactions, async () => {
    const credit = await db.credits.get(id)
    if (!credit) return
    const payments = await db.creditPayments.where('creditId').equals(id).toArray()
    const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
    if (input.totalAmount + 0.001 < paid) throw new Error('Le montant dû ne peut pas être inférieur à ce qui est déjà payé.')
    await db.credits.update(id, {
      name,
      lender,
      totalAmount: input.totalAmount,
      monthlyPayment: input.monthlyPayment,
      startDate: input.startDate,
      months: input.months,
      accountId: input.accountId,
      note,
    })
    if (credit.transactionId != null) {
      await db.transactions.update(credit.transactionId, { amount: input.totalAmount, accountId: input.accountId, note: note || name })
    }
    await refreshCredit(id)
  })
}

export async function payCredit(id: number, amount: number, date: string) {
  assertMoney(amount)
  assertDate(date)
  await db.transaction('rw', db.credits, db.creditPayments, db.transactions, async () => {
    const credit = await db.credits.get(id)
    if (!credit) throw new Error('Introuvable.')
    const payments = await db.creditPayments.where('creditId').equals(id).toArray()
    const remaining = round2(credit.totalAmount - payments.reduce((sum, payment) => sum + payment.amount, 0))
    if (remaining <= 0) throw new Error('Ce crédit est déjà soldé.')
    if (amount - remaining > 0.001) throw new Error('Le montant dépasse le reste dû.')
    const used = new Set(payments.map((payment) => payment.installment))
    let installment = 1
    while (used.has(installment)) installment += 1
    const txId = await db.transactions.add({
      type: 'creditOut',
      amount,
      accountId: credit.accountId,
      date,
      note: `${credit.name} · échéance ${installment}`,
      createdAt: Date.now(),
    })
    await db.creditPayments.add({ creditId: id, installment, amount, date, transactionId: txId })
    await refreshCredit(id)
  })
}

export async function deleteCredit(id: number) {
  await db.transaction('rw', db.credits, db.creditPayments, db.transactions, async () => {
    const credit = await db.credits.get(id)
    if (!credit) return
    const payments = await db.creditPayments.where('creditId').equals(id).toArray()
    const txIds = [credit.transactionId, ...payments.map((payment) => payment.transactionId)].filter((txId): txId is number => txId != null)
    await db.creditPayments.where('creditId').equals(id).delete()
    if (txIds.length) await db.transactions.bulkDelete(txIds)
    await db.credits.delete(id)
  })
}

export async function createNouran(input: {
  kind: NouranKind
  amount: number
  date: string
  description: string
  product: string
  quantity: number | null
  accountId: number | null
}) {
  assertMoney(input.amount)
  assertDate(input.date)
  const description = cleanNote(input.description)
  const product = input.product.trim()
  if (product.length > 80) throw new Error('Le nom du produit est trop long.')
  if (input.quantity != null && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
    throw new Error('La quantité n’est pas valide.')
  }
  await db.transaction('rw', db.nouranEntries, db.transactions, db.categories, async () => {
    let transactionId: number | undefined
    if (input.accountId != null) {
      const kind = input.kind === 'sale' ? 'income' : 'expense'
      const category = await db.categories.filter((item) => item.kind === kind && item.name === 'Nouran Parfums').first()
      transactionId = await db.transactions.add({
        type: kind,
        amount: input.amount,
        accountId: input.accountId,
        date: input.date,
        note: [product, description].filter(Boolean).join(' · ') || 'Nouran Parfums',
        createdAt: Date.now(),
        ...(category ? { categoryId: category.id } : {}),
      })
    }
    await db.nouranEntries.add({
      kind: input.kind,
      amount: input.amount,
      date: input.date,
      description,
      product,
      ...(input.quantity != null ? { quantity: input.quantity } : {}),
      ...(input.accountId != null ? { accountId: input.accountId } : {}),
      ...(transactionId != null ? { transactionId } : {}),
    })
  })
}

export async function deleteNouran(id: number) {
  await db.transaction('rw', db.nouranEntries, db.transactions, async () => {
    const entry = await db.nouranEntries.get(id)
    if (!entry) return
    if (entry.transactionId != null) await db.transactions.delete(entry.transactionId)
    await db.nouranEntries.delete(id)
  })
}
