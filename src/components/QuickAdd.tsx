import { createContext, useContext, useState, type ReactNode } from 'react'
import { useMoney } from '../context/MoneyContext.tsx'
import { createLifeTransaction } from '../lib/actions.ts'
import { Sheet } from './ui.tsx'
import { TransactionForm } from './TransactionForm.tsx'

export type QuickPreset = {
  type?: 'income' | 'expense' | 'transfer'
  categoryName?: string
}

const QuickContext = createContext<(preset?: QuickPreset) => void>(() => {})

export function useQuickAdd() {
  return useContext(QuickContext)
}

export function QuickProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<QuickPreset | null>(null)
  return (
    <QuickContext.Provider value={(next) => setPreset(next ?? {})}>
      {children}
      <QuickAdd preset={preset} onClose={() => setPreset(null)} />
    </QuickContext.Provider>
  )
}

function QuickAdd({ preset, onClose }: { preset: QuickPreset | null; onClose: () => void }) {
  const { categories } = useMoney()
  const type = preset?.type ?? 'expense'
  const category = preset?.categoryName
    ? categories.find((item) => item.name === preset.categoryName && item.kind === (type === 'income' ? 'income' : 'expense'))
    : undefined

  return (
    <Sheet open={preset != null} title="Ajouter" onClose={onClose}>
      {preset != null && (
        <TransactionForm
          key={`${type}-${category?.id ?? 0}`}
          initialType={type}
          initialCategoryId={category?.id}
          submitLabel="Enregistrer"
          onSubmit={async (draft) => {
            await createLifeTransaction(draft)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
