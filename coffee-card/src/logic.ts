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

/** 0541234567 -> 054-1234567, 021234567 -> 02-1234567. The dash keeps Excel from dropping the leading zero. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  const area = d.length === 10 ? 3 : 2
  return /^0\d{8,9}$/.test(d) ? `${d.slice(0, area)}-${d.slice(area)}` : phone
}

/** SQLite UTC timestamp ("2026-10-08 09:31:00") -> Israel time ("2026-10-08 12:31"). */
export function formatIsraelTime(sqlUtc: string): string {
  const ms = Date.parse(sqlUtc.replace(' ', 'T') + 'Z')
  if (Number.isNaN(ms)) return sqlUtc
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

export const EVENT_LABELS: Record<string, string> = { stamp: 'חתימה', redeem: 'מימוש מתנה', birthday: 'מתנת יום הולדת' }

export const THEME_COLOR = '#537c6d'

/** Per-card web app manifest, so an installed app opens straight on that customer's card. */
export function buildManifest(shop: string, token: string) {
  const base = `/c/${token}`
  return {
    id: base,
    name: shop,
    short_name: shop.length > 12 ? shop.split(' ')[0] : shop,
    start_url: base,
    scope: base,
    display: 'standalone',
    lang: 'he',
    dir: 'rtl',
    theme_color: THEME_COLOR,
    background_color: '#f6f1ea',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

/** wa.me link that opens WhatsApp to this Israeli number with a ready message. */
export function whatsappLink(phone: string, text: string): string | null {
  const d = phone.replace(/\D/g, '')
  if (!/^0\d{8,9}$/.test(d)) return null
  return `https://wa.me/972${d.slice(1)}?text=${encodeURIComponent(text)}`
}
