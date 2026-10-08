export function formatMoney(amount, settings) {
  const symbol = settings?.currencySymbol || '₵'
  const n = Number(amount || 0)
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export const LICENSE_LABELS = {
  mp3: 'MP3 Lease',
  wav: 'WAV Lease',
  exclusive: 'Exclusive Rights',
}

export const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border border-red-500/30',
  refunded: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  cancelled: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
}
