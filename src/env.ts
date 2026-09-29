export type Bindings = {
  DB: D1Database
  /** HMAC key for admin session cookies (wrangler pages secret put SESSION_SECRET). */
  SESSION_SECRET: string
  /** One-time token required to create the very first admin account. */
  SETUP_TOKEN?: string
  /** PayPal REST app credentials. When both are set, checkout uses automatic PayPal payments. */
  PAYPAL_CLIENT_ID?: string
  PAYPAL_CLIENT_SECRET?: string
  /** 'live' or 'sandbox' (default). */
  PAYPAL_ENV?: string
  /** Optional: enables webhook signature verification. */
  PAYPAL_WEBHOOK_ID?: string
  /** Optional override of the PayPal API base URL (tests). */
  PAYPAL_API_BASE?: string
}

export type AdminUser = { id: number; username: string }

export type AppEnv = {
  Bindings: Bindings
  Variables: { admin: AdminUser }
}
