import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PinPad } from '../components/PinPad.tsx'
import { AmountField, Button, ErrorText, PageHeader, Segmented, Sheet, TextField } from '../components/ui.tsx'
import { useMoney } from '../context/MoneyContext.tsx'
import { deleteAccount, renameCategory, saveAccount, saveCategory, setAccountArchived, setCategoryArchived } from '../lib/actions.ts'
import { buildBackup, downloadBackup, eraseAll, parseBackup, replaceWithBackup } from '../lib/backup.ts'
import { accountKindLabel } from '../lib/labels.ts'
import { hasPin, pinMatches, removePin, savePin } from '../lib/pin.ts'
import { amountToInput, errorMessage, mad, parseAmount } from '../lib/format.ts'
import { accountBalance } from '../lib/calc.ts'
import type { Account, AccountKind, Category } from '../types.ts'
import { useTheme } from '../theme.tsx'

const COLORS = ['#e4c88a', '#f3ede3', '#7fa3c9', '#1e4e86', '#c4a36a', '#0a1f3d']

type PinFlow =
  | { mode: 'create'; step: 'first' | 'second'; first: string }
  | { mode: 'remove' }
  | { mode: 'change'; step: 'current' | 'next' | 'confirm'; first: string }

export function Settings() {
  const money = useMoney()
  const { theme, setTheme } = useTheme()
  const [accountEdit, setAccountEdit] = useState<Account | 'new' | null>(null)
  const [categoryKind, setCategoryKind] = useState<'income' | 'expense'>('expense')
  const [categoryName, setCategoryName] = useState('')
  const [rename, setRename] = useState<Category | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pinOn, setPinOn] = useState(hasPin)
  const [pinFlow, setPinFlow] = useState<PinFlow | null>(null)
  const [pinError, setPinError] = useState('')
  const [pinReset, setPinReset] = useState(0)
  const [usage, setUsage] = useState('')

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      if (estimate.usage == null) return
      const ko = estimate.usage / 1024
      setUsage(ko < 1024 ? `${Math.max(1, Math.round(ko))} Ko` : `${(ko / 1024).toFixed(1)} Mo`)
    }).catch(() => undefined)
  }, [money.transactions.length])

  async function onPin(pin: string) {
    if (!pinFlow) return
    if (pinFlow.mode === 'create' && pinFlow.step === 'first') {
      setPinFlow({ mode: 'create', step: 'second', first: pin })
      setPinError('')
      setPinReset((value) => value + 1)
      return
    }
    if (pinFlow.mode === 'create' && pinFlow.step === 'second') {
      if (pin !== pinFlow.first) {
        setPinFlow({ mode: 'create', step: 'first', first: '' })
        setPinError('Les deux codes sont différents.')
        setPinReset((value) => value + 1)
        return
      }
      await savePin(pin)
      setPinOn(true)
      setPinFlow(null)
      return
    }
    if (pinFlow.mode === 'remove') {
      if (!(await pinMatches(pin))) {
        setPinError('Code incorrect.')
        setPinReset((value) => value + 1)
        return
      }
      removePin()
      setPinOn(false)
      setPinFlow(null)
      return
    }
    if (pinFlow.step === 'current') {
      if (!(await pinMatches(pin))) {
        setPinError('Code incorrect.')
        setPinReset((value) => value + 1)
        return
      }
      setPinFlow({ mode: 'change', step: 'next', first: '' })
      setPinError('')
      setPinReset((value) => value + 1)
      return
    }
    if (pinFlow.step === 'next') {
      setPinFlow({ mode: 'change', step: 'confirm', first: pin })
      setPinError('')
      setPinReset((value) => value + 1)
      return
    }
    if (pin !== pinFlow.first) {
      setPinFlow({ mode: 'change', step: 'next', first: '' })
      setPinError('Les deux codes sont différents.')
      setPinReset((value) => value + 1)
      return
    }
    await savePin(pin)
    setPinOn(true)
    setPinFlow(null)
  }

  const pinTitle = !pinFlow
    ? ''
    : pinFlow.mode === 'remove'
      ? 'Code actuel'
      : pinFlow.mode === 'create'
        ? pinFlow.step === 'first' ? 'Choisis un code' : 'Confirme le code'
        : pinFlow.step === 'current'
          ? 'Code actuel'
          : pinFlow.step === 'next'
            ? 'Nouveau code'
            : 'Confirme le code'

  return (
    <div>
      <Link to="/plus" className="mb-3 inline-block text-sm text-gold">Retour</Link>
      <PageHeader title="Réglages" />
      <ErrorText>{error}</ErrorText>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Comptes</h2>
          <Button tone="ghost" onClick={() => setAccountEdit('new')}>Ajouter</Button>
        </div>
        <div className="overflow-hidden rounded-3xl bg-elev ring-1 ring-line">
          {money.accounts.map((account) => {
            const balance = accountBalance(account.openingBalance, account.id, money.transactions)
            return (
              <button key={account.id} type="button" className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0" onClick={() => setAccountEdit(account)}>
                <span className="h-3 w-3 rounded-full" style={{ background: account.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{account.name}</span>
                  <span className="text-xs text-muted">{accountKindLabel(account.kind)}{account.archived ? ' · archivé' : ''}</span>
                </span>
                <span className="num text-sm">{mad(balance)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-serif text-2xl">Catégories</h2>
        <Segmented
          value={categoryKind}
          onChange={setCategoryKind}
          options={[{ id: 'expense', label: 'Dépenses' }, { id: 'income', label: 'Revenus' }]}
        />
        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveCategory(categoryName, categoryKind).then(() => { setCategoryName(''); setError(null) }).catch((err: unknown) => setError(errorMessage(err)))
          }}
        >
          <input className="w-full rounded-2xl bg-soft px-4 py-3 outline-none" value={categoryName} placeholder="Nouvelle catégorie" onChange={(event) => setCategoryName(event.target.value)} />
          <Button type="submit">OK</Button>
        </form>
        <div className="overflow-hidden rounded-3xl bg-elev ring-1 ring-line">
          {money.categories.filter((category) => category.kind === categoryKind).map((category) => (
            <div key={category.id} className="flex items-center gap-2 border-b border-line px-4 py-3 last:border-b-0">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-soft">{category.symbol}</span>
              <button type="button" className={category.archived ? 'min-w-0 flex-1 truncate text-left text-muted' : 'min-w-0 flex-1 truncate text-left'} onClick={() => { setRename(category); setRenameValue(category.name) }}>
                {category.name}{category.archived ? ' · archivée' : ''}
              </button>
              <button type="button" className="text-xs text-gold" onClick={() => void setCategoryArchived(category.id, !category.archived)}>
                {category.archived ? 'Rétablir' : 'Archiver'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">Apparence</h2>
        <div className="mt-3">
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[{ id: 'dark', label: 'Sombre' }, { id: 'light', label: 'Clair' }]}
          />
        </div>
      </section>

      <section className="mb-6 rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">Code</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">Quatre chiffres demandés à l’ouverture. Ils restent sur cet appareil.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!pinOn && <Button onClick={() => { setPinError(''); setPinReset((value) => value + 1); setPinFlow({ mode: 'create', step: 'first', first: '' }) }}>Activer</Button>}
          {pinOn && <Button tone="ghost" onClick={() => { setPinError(''); setPinReset((value) => value + 1); setPinFlow({ mode: 'change', step: 'current', first: '' }) }}>Changer</Button>}
          {pinOn && <Button tone="danger" onClick={() => { setPinError(''); setPinReset((value) => value + 1); setPinFlow({ mode: 'remove' }) }}>Retirer</Button>}
        </div>
      </section>

      <section className="mb-6 rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">Sauvegarde</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Tes chiffres sont dans ce téléphone{usage ? ` (${usage})` : ''}. Safari peut effacer un site rarement ouvert. Exporte une copie de temps en temps, et installe l’app sur l’écran d’accueil.
        </p>
        <div className="mt-3 grid gap-2">
          <Button onClick={() => void buildBackup().then(downloadBackup).catch((err: unknown) => setError(errorMessage(err)))}>Télécharger une copie</Button>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Remplacer par une sauvegarde</span>
            <input
              className="block w-full text-sm"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then(async (text) => {
                  const backup = parseBackup(text)
                  if (!window.confirm('Tes données actuelles seront remplacées par ce fichier. Continuer ?')) return
                  await replaceWithBackup(backup)
                }).catch((err: unknown) => setError(errorMessage(err)))
              }}
            />
          </label>
          <Button
            tone="danger"
            onClick={() => {
              if (!window.confirm('Effacer toutes les données de cet appareil ?')) return
              if (!window.confirm('C’est définitif, sauf si tu as exporté une copie. Confirmer ?')) return
              void eraseAll().catch((err: unknown) => setError(errorMessage(err)))
            }}
          >
            Tout effacer
          </Button>
        </div>
      </section>

      <section className="rounded-3xl bg-elev p-4 ring-1 ring-line">
        <h2 className="font-serif text-2xl">Sur l’iPhone</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-muted">
          <li>Ouvre l’adresse https dans Safari.</li>
          <li>Partager.</li>
          <li>Sur l’écran d’accueil.</li>
        </ol>
      </section>

      <Sheet open={accountEdit != null} title={accountEdit === 'new' ? 'Nouveau compte' : 'Compte'} onClose={() => setAccountEdit(null)}>
        {accountEdit && <AccountForm initial={accountEdit === 'new' ? undefined : accountEdit} onClose={() => setAccountEdit(null)} onError={setError} />}
      </Sheet>
      <Sheet open={rename != null} title="Renommer" onClose={() => setRename(null)}>
        {rename && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void renameCategory(rename.id, renameValue).then(() => setRename(null)).catch((err: unknown) => setError(errorMessage(err)))
            }}
          >
            <TextField label="Nom" value={renameValue} onChange={setRenameValue} />
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={pinFlow != null} title={pinTitle} onClose={() => setPinFlow(null)}>
        <PinPad resetKey={pinReset} onComplete={(pin) => void onPin(pin)} />
        {pinError && <p className="text-center text-sm text-bad">{pinError}</p>}
      </Sheet>
    </div>
  )
}

function AccountForm({ initial, onClose, onError }: { initial?: Account; onClose: () => void; onError: (message: string | null) => void }) {
  const { transactions } = useMoney()
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'cash')
  const [opening, setOpening] = useState(initial ? amountToInput(initial.openingBalance) : '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const openingBalance = parseAmount(opening || '0', { allowZero: true, allowNegative: true })
    if (openingBalance == null) {
      setError('Le solde de départ n’est pas valide.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveAccount({ id: initial?.id, name, kind, openingBalance, color })
      onError(null)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextField label="Nom" value={name} onChange={setName} placeholder="Espèces, Banque…" />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[{ id: 'cash', label: 'Espèces' }, { id: 'bank', label: 'Banque' }, { id: 'other', label: 'Autre' }]}
      />
      <AmountField label="Solde de départ" value={opening} onChange={setOpening} />
      <p className="mb-3 text-xs leading-relaxed text-muted">Le solde affiché ajoute ensuite toutes les opérations. Ici, tu règles seulement le point de départ.</p>
      <div className="mb-4 flex gap-2">
        {COLORS.map((item) => (
          <button key={item} type="button" className={color === item ? 'h-8 w-8 rounded-full ring-2 ring-ink ring-offset-2 ring-offset-elev' : 'h-8 w-8 rounded-full'} style={{ background: item }} onClick={() => setColor(item)} aria-label={item} />
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={saving}>Enregistrer</Button>
      {initial && (
        <div className="mt-2 grid gap-2">
          <Button tone="ghost" onClick={() => void setAccountArchived(initial.id, !initial.archived).then(onClose).catch((err: unknown) => setError(errorMessage(err)))}>
            {initial.archived ? 'Réactiver' : 'Archiver'}
          </Button>
          <Button
            tone="danger"
            onClick={() => {
              if (!window.confirm('Supprimer ce compte ?')) return
              void deleteAccount(initial.id).then(onClose).catch((err: unknown) => setError(errorMessage(err)))
            }}
          >
            Supprimer
          </Button>
          <p className="text-xs text-muted">Solde actuel {mad(accountBalance(initial.openingBalance, initial.id, transactions))}.</p>
        </div>
      )}
    </form>
  )
}
