/** "15:00" + 40 → "15:40" (24 h, wraps past midnight). */
export function clockAdd(nowClock: string, minutes: number): string {
  const [h, m] = nowClock.split(':').map(Number)
  let total = Math.round(h * 60 + m + minutes)
  total = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function leadLabel(t: number): string {
  const r = Math.round(t)
  if (r === 0) return 'now'
  return `${r > 0 ? '+' : '−'}${Math.abs(r)} min`
}

/** ISO timestamp in IST for a scenario date + clock + offset minutes. */
export function istIso(dateIso: string, nowClock: string, minutes: number): string {
  const [h, m] = nowClock.split(':').map(Number)
  const base = new Date(`${dateIso}T00:00:00+05:30`).getTime()
  const ms = base + (h * 60 + m + minutes) * 60000
  // Format back in IST
  const d = new Date(ms + 5.5 * 3600000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}:00+05:30`
}
