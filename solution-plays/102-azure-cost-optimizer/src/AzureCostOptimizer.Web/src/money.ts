export function compareDecimals(left: string, right: string) {
  const leftDecimal = parseDecimal(left)
  const rightDecimal = parseDecimal(right)
  const scale = Math.max(leftDecimal.scale, rightDecimal.scale)
  const leftValue = leftDecimal.value * 10n ** BigInt(scale - leftDecimal.scale)
  const rightValue = rightDecimal.value * 10n ** BigInt(scale - rightDecimal.scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

export function formatCurrency(value: string, currency: string) {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  const decimal = parseDecimal(value)
  const negative = decimal.value < 0n
  const magnitude = negative ? -decimal.value : decimal.value
  const sourceScale = 10n ** BigInt(decimal.scale)
  const displayScale = 10n ** BigInt(digits)
  const rounded = decimal.scale <= digits
    ? magnitude * 10n ** BigInt(digits - decimal.scale)
    : (magnitude + sourceScale / displayScale / 2n) / (sourceScale / displayScale)
  const whole = rounded / displayScale
  const fraction = digits ? (rounded % displayScale).toString().padStart(digits, '0') : ''
  const groupedWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(whole)
  const rendered = formatter.formatToParts(0).map((part) => {
    if (part.type === 'integer') return groupedWhole
    if (part.type === 'fraction') return fraction
    return part.value
  }).join('')
  return negative ? `-${rendered}` : rendered
}

function parseDecimal(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error('Invalid canonical decimal amount.')
  const fraction = match[3] ?? ''
  const magnitude = BigInt(`${match[2]}${fraction}`)
  return { value: match[1] ? -magnitude : magnitude, scale: fraction.length }
}

export function normalizeChartCoordinates(values: string[], maximum = 10000) {
  const decimals = values.map(parseDecimal)
  const scale = Math.max(...decimals.map((value) => value.scale))
  const scaled = decimals.map((decimal) => decimal.value * 10n ** BigInt(scale - decimal.scale))
  const largest = scaled.reduce((current, value) => value > current ? value : current, 0n)
  if (largest === 0n) return scaled.map(() => 0)
  return scaled.map((value) => Number(value * BigInt(maximum) / largest))
}