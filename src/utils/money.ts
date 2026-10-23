export function formatMoney(value: number | null | undefined): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const absoluteAmount = Math.abs(amount)

  if (absoluteAmount < 1000) return `${amount.toLocaleString('vi-VN')} ₫`

  // Keep one decimal so 1.500 ₫ renders as "1,5K ₫" instead of rounding to 2K.
  return `${(amount / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}K ₫`
}
