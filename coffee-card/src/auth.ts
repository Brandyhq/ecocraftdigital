const enc = new TextEncoder()

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function pinMatches(pin: string, expected: string): Promise<boolean> {
  // Compare HMACs so length/timing of the PIN does not leak.
  const [a, b] = await Promise.all([hmac('pin', pin), hmac('pin', expected)])
  return safeEqual(a, b)
}

/** Session token: "<expiresAtMs>.<hmac>" signed with the secret. */
export async function issueSession(secret: string, ttlMs = 12 * 3600_000): Promise<string> {
  const exp = String(Date.now() + ttlMs)
  return `${exp}.${await hmac(secret, exp)}`
}

export async function sessionValid(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmac(secret, exp))
}
