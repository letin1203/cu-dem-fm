export function formatMoney(value: number | null | undefined): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const absoluteAmount = Math.abs(amount)

  if (absoluteAmount < 1000) return `${amount.toLocaleString('vi-VN')} ₫`

  return `${(amount / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}K ₫`
}
