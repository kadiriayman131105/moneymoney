export function iso(d: Date) {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function todayISO() {
  return iso(new Date())
}

export function parseISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isISODate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return iso(parseISO(s)) === s
}

export function monthKey(s: string) {
  return s.slice(0, 7)
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, (m ?? 1) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(s: string, n: number) {
  const d = parseISO(s)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return iso(target)
}

export function addDays(s: string, days: number) {
  const d = parseISO(s)
  d.setDate(d.getDate() + days)
  return iso(d)
}

export function clampDay(year: number, monthIndex: number, day: number) {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return iso(new Date(year, monthIndex, Math.min(Math.max(day, 1), last)))
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(y, (m ?? 1) - 1, 1))
}

export function shortMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, (m ?? 1) - 1, 1)).replace('.', '')
}

export function dayLabel(s: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(s))
}

export function shortDate(s: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(parseISO(s))
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 18) return h < 12 ? 'Bonjour' : 'Bon après-midi'
  return 'Bonsoir'
}
