import { type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useMoney } from '../context/MoneyContext.tsx'
import { IconHome, IconList, IconMore, IconPeople, IconPlus } from './icons.tsx'
import { QuickProvider, useQuickAdd } from './QuickAdd.tsx'
import { cx, Splash } from './ui.tsx'

export function Layout() {
  return (
    <QuickProvider>
      <Shell />
    </QuickProvider>
  )
}

function Shell() {
  const money = useMoney()
  const open = useQuickAdd()
  if (!money.loaded) return <Splash />
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-32">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5 items-end rounded-[28px] border border-line bg-elev/95 px-1 shadow-[0_16px_40px_rgba(7,20,34,0.28)] backdrop-blur">
          <Tab to="/" end label="Accueil" icon={<IconHome />} />
          <Tab to="/mouvements" label="Mouvements" icon={<IconList />} />
          <div className="flex justify-center">
            <button type="button" className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-gold text-on shadow-[0_10px_24px_rgba(7,20,34,0.35)]" aria-label="Ajouter une opération" onClick={() => open()}>
              <IconPlus />
            </button>
          </div>
          <Tab to="/engagements" label="Engagements" icon={<IconPeople />} />
          <Tab to="/plus" label="Plus" icon={<IconMore />} />
        </div>
      </nav>
    </div>
  )
}

function Tab({ to, label, icon, end = false }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-gold' : 'text-muted')}>
      {icon}
      {label}
    </NavLink>
  )
}
