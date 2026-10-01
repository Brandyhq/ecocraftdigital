export const STAMP_COOLDOWN_SECONDS = 30

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '').replace(/^\+972/, '0').replace(/^972/, '0')
  return /^0\d{8,9}$/.test(digits) ? digits : null
}

export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** A reward is available once enough stamps are collected. */
export function rewardReady(stamps: number, needed: number): boolean {
  return stamps >= needed
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

const TZ = 'Asia/Jerusalem'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const BIRTHDAY_MIN_CARD_AGE_DAYS = 7

function israelParts(now: Date): { weekday: number; month: number; year: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'numeric', year: 'numeric' })
      .formatToParts(now).map((x) => [x.type, x.value]),
  )
  return { weekday: WEEKDAYS.indexOf(p.weekday), month: Number(p.month), year: Number(p.year) }
}

/** DOUBLE_STAMP_DAYS is a comma list of weekdays, 0=Sunday … 6=Saturday (Israel time). */
export function stampMultiplier(doubleDays: string, now = new Date()): number {
  const days = doubleDays.split(',').map((d) => d.trim()).filter(Boolean).map(Number)
  return days.includes(israelParts(now).weekday) ? 2 : 1
}

export function parseBirthday(month: string, day: string): string | null {
  const m = Number(month), d = Number(day)
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1) return null
  const maxDay = new Date(Date.UTC(2024, m, 0)).getUTCDate() // 2024 is a leap year: allow 29/2
  if (d > maxDay) return null
  return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Birthday gift: once per calendar year, during the birthday month, for cards at least a week old. */
export function birthdayAvailable(
  card: { birthday: string | null; birthday_reward_year: number | null; created_at: string },
  now = new Date(),
): boolean {
  if (!card.birthday) return false
  const { month, year } = israelParts(now)
  if (Number(card.birthday.slice(0, 2)) !== month) return false
  if (card.birthday_reward_year === year) return false
  const ageDays = (now.getTime() - Date.parse(card.created_at.replace(' ', 'T') + 'Z')) / 86_400_000
  return ageDays >= BIRTHDAY_MIN_CARD_AGE_DAYS
}

export function currentYear(now = new Date()): number {
  return israelParts(now).year
}

/** CSV cell with quoting and neutralisation of spreadsheet formulas (=, +, -, @). */
export function csvCell(v: string | number | null): string {
  let s = v === null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: (string | number | null)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n' // BOM so Excel reads Hebrew
}
