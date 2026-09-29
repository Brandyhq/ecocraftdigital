export type Bindings = {
  DB: D1Database
  /** HMAC key for admin session cookies (wrangler pages secret put SESSION_SECRET). */
  SESSION_SECRET: string
  /** One-time token required to create the very first admin account. */
  SETUP_TOKEN?: string
}

export type AdminUser = { id: number; username: string }

export type AppEnv = {
  Bindings: Bindings
  Variables: { admin: AdminUser }
}
