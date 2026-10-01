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
