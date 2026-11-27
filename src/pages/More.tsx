import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui.tsx'

const LINKS = [
  { to: '/nouran', title: 'Nouran Parfums', text: 'Achats, ventes, frais et bénéfice du projet.' },
  { to: '/rapports', title: 'Rapports', text: 'Six ou douze mois, par catégorie et par source.' },
  { to: '/reglages', title: 'Réglages', text: 'Comptes, catégories, code et sauvegarde.' },
]

export function More() {
  return (
    <div>
      <PageHeader title="Plus" kicker="Moneymoney" />
      <div className="space-y-3">
        {LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="block rounded-3xl bg-elev p-4 ring-1 ring-line">
            <p className="font-serif text-2xl">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Salaire, cadeaux, dépenses, obligations, crédits, argent prêté et Nouran Parfums vivent ici. Rien n’est envoyé sur un serveur.
      </p>
    </div>
  )
}
