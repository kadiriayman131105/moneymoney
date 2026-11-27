export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function mad(n: number) {
  const abs = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
  return n < 0 ? `−${abs} DH` : `${abs} DH`
}

export function madSigned(amount: number, direction: -1 | 0 | 1) {
  const base = mad(Math.abs(amount))
  if (direction > 0) return `+${base}`
  if (direction < 0) return `−${base}`
  return base
}

export function amountToInput(n: number) {
  return n.toFixed(2).replace('.', ',')
}

export function parseAmount(
  raw: string,
  opts: { allowZero?: boolean; allowNegative?: boolean } = {},
) {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t || t === '-' || t === '.') return null
  const re = opts.allowNegative ? /^-?\d+(\.\d{0,2})?$/ : /^\d+(\.\d{0,2})?$/
  if (!re.test(t)) return null
  const n = round2(Number(t))
  if (!Number.isFinite(n)) return null
  if (!opts.allowNegative && n < 0) return null
  if (!opts.allowZero && n === 0) return null
  return n
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Une erreur est survenue.'
}
