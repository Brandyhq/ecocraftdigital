import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../env'
import { sha256Hex, sign, verify } from './crypto'

const COOKIE = 'ec_admin'
const SESSION_TTL_SECONDS = 60 * 60 * 12

type SessionPayload = { uid: number; sv: string; exp: number }

/** Ties a session to the current password hash so changing the password revokes old sessions. */
export const sessionVersion = async (passwordHash: string) => (await sha256Hex(passwordHash)).slice(0, 16)

export async function startSession(c: Context<AppEnv>, user: { id: number; password_hash: string }) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const token = await sign({ uid: user.id, sv: await sessionVersion(user.password_hash), exp } satisfies SessionPayload, c.env.SESSION_SECRET)
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  })
}

export const endSession = (c: Context<AppEnv>) => deleteCookie(c, COOKIE, { path: '/' })

export async function currentAdmin(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE)
  if (!token || !c.env.SESSION_SECRET) return null
  const payload = await verify<SessionPayload>(token, c.env.SESSION_SECRET)
  if (!payload || payload.exp < Date.now() / 1000) return null
  const user = await c.env.DB.prepare('SELECT id, username, password_hash FROM admin_users WHERE id = ?').bind(payload.uid).first<{
    id: number
    username: string
    password_hash: string
  }>()
  if (!user || (await sessionVersion(user.password_hash)) !== payload.sv) return null
  return user
}

/**
 * Guards every mutating/reading admin route. Mutations also need the custom
 * X-Requested-With header, which browsers will not attach to cross-site requests
 * (defence in depth on top of the SameSite=Strict cookie).
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentAdmin(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  if (c.req.method !== 'GET' && c.req.header('X-Requested-With') !== 'ecocraft') {
    return c.json({ success: false, error: 'Forbidden' }, 403)
  }
  c.set('admin', { id: user.id, username: user.username })
  await next()
}
