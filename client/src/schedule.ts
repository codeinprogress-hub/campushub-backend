/** Tomorrow's calendar date in UTC, as YYYY-MM-DD. */
export function tomorrowUtcDate(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return next.toISOString().slice(0, 10)
}

/** One-hour reservation starting at `HH:MM` on a UTC calendar date. */
export function slotRange(date: string, start: string): { startTime: string; endTime: string } {
  const [hourText, minuteText] = start.split(':')
  const startDate = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      Number(hourText),
      Number(minuteText),
      0,
    ),
  )
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  return {
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  }
}

/** 24-hour UTC clock label: 10:00 -> 10:00 AM, 14:00 -> 2:00 PM. */
export function formatUtcTime(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/)
  if (!match) return iso
  const hour24 = Number(match[1])
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${match[2]} ${suffix}`
}

export function formatUtcDate(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : iso
}
