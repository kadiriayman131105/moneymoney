import { useEffect, useState, type FormEvent } from 'react'
import { useMoney } from '../context/MoneyContext.tsx'
import { todayISO } from '../lib/dates.ts'
import { amountToInput, errorMessage, parseAmount } from '../lib/format.ts'
import { isLifeType, openAccounts, openCategories } from '../lib/labels.ts'
import type { LifeTxDraft, Transaction } from '../types.ts'
import { AmountField, Button, DateField, ErrorText, Segmented, SelectField, TextField } from './ui.tsx'

export function TransactionForm({
  initial,
  initialType = 'expense',
  initialCategoryId,
  submitLabel,
  onSubmit,
}: {
  initial?: Transaction
  initialType?: 'income' | 'expense' | 'transfer'
  initialCategoryId?: number
  submitLabel: string
  onSubmit: (draft: LifeTxDraft) => Promise<void>
}) {
  const { accounts, categories } = useMoney()
  const lifeInitial = initial && isLifeType(initial.type) ? initial : undefined
  const startingType = initial && isLifeType(initial.type) ? initial.type : initialType
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(startingType)
  const [amount, setAmount] = useState(lifeInitial ? amountToInput(lifeInitial.amount) : '')
  const [date, setDate] = useState(lifeInitial?.date ?? todayISO())
  const [note, setNote] = useState(lifeInitial?.note ?? '')
  const [accountId, setAccountId] = useState<number | undefined>(lifeInitial?.accountId)
  const [toAccountId, setToAccountId] = useState<number | undefined>(lifeInitial?.toAccountId)
  const [categoryId, setCategoryId] = useState<number | undefined>(lifeInitial?.categoryId ?? initialCategoryId)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = openAccounts(accounts)
  const categoryKind = type === 'income' ? 'income' : 'expense'
  const categoryList = openCategories(categories, categoryKind)
  const selectedCategory = categories.find((category) => category.id === categoryId)

  useEffect(() => {
    const list = openAccounts(accounts)
    setAccountId((current) => (current != null && accounts.some((account) => account.id === current) ? current : list[0]?.id))
  }, [accounts])

  useEffect(() => {
    if (type !== 'transfer') return
    const list = openAccounts(accounts)
    setToAccountId((current) => {
      if (current != null && current !== accountId && accounts.some((account) => account.id === current)) return current
      return list.find((account) => account.id !== accountId)?.id
    })
  }, [type, accountId, accounts])

  useEffect(() => {
    if (type === 'transfer') return
    const list = openCategories(categories, type === 'income' ? 'income' : 'expense')
    setCategoryId((current) => (current != null && list.some((category) => category.id === current) ? current : list[0]?.id))
  }, [type, categories])

  const notePlaceholder = selectedCategory?.name === 'Salaire'
    ? 'Société, mois…'
    : selectedCategory?.name === 'Cadeau'
      ? 'De la part de…'
      : selectedCategory?.name === 'Nouran Parfums'
        ? 'Client, commande…'
        : 'Note'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (parsed == null) {
      setError('Indique un montant supérieur à zéro.')
      return
    }
    if (accountId == null) {
      setError('Ajoute un compte dans Réglages.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        type,
        amount: parsed,
        accountId,
        toAccountId: toAccountId ?? null,
        categoryId: categoryId ?? null,
        date,
        note,
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { id: 'expense', label: 'Dépense' },
          { id: 'income', label: 'Revenu' },
          { id: 'transfer', label: 'Virement' },
        ]}
      />
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <SelectField label={type === 'transfer' ? 'Depuis' : 'Compte'} value={accountId ?? ''} onChange={(value) => setAccountId(Number(value))}>
        {visible.map((account) => (
          <option key={account.id} value={account.id}>{account.name}</option>
        ))}
      </SelectField>
      {type === 'transfer' ? (
        <SelectField label="Vers" value={toAccountId ?? ''} onChange={(value) => setToAccountId(Number(value))}>
          {visible.filter((account) => account.id !== accountId).map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </SelectField>
      ) : (
        <SelectField label="Catégorie" value={categoryId ?? ''} onChange={(value) => setCategoryId(Number(value))}>
          {categoryList.map((category) => (
            <option key={category.id} value={category.id}>{category.symbol} {category.name}</option>
          ))}
        </SelectField>
      )}
      <TextField label="Note" value={note} onChange={setNote} placeholder={notePlaceholder} />
      {type === 'income' && <p className="mb-3 text-xs leading-relaxed text-muted">Salaire, cadeau, vente Nouran, remboursement d’un achat : choisis la catégorie qui correspond.</p>}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving || visible.length === 0}>{submitLabel}</Button>
    </form>
  )
}
