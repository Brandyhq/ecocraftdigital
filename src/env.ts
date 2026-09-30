export type Bindings = {
  DB: D1Database
  /** HMAC key for admin session cookies (wrangler pages secret put SESSION_SECRET). */
  SESSION_SECRET: string
  /** One-time token required to create the very first admin account. */
  SETUP_TOKEN?: string
  /** Optional canonical origin (e.g. https://ecocraftdigital.com). Defaults to the request host. */
  SITE_URL?: string
  /** PayPlus (Israeli cards + Bit). All three are needed to enable online payments. */
  PAYPLUS_API_KEY?: string
  PAYPLUS_SECRET_KEY?: string
  PAYPLUS_PAGE_UID?: string
  /** 'production' or 'sandbox' (default). */
  PAYPLUS_ENV?: string
  /** Set to 'true' to ask PayPlus to issue an invoice/receipt automatically (needs the invoice module). */
  PAYPLUS_INVOICES?: string
  /** Optional override of the PayPlus API base URL (tests). */
  PAYPLUS_API_BASE?: string
  /** Resend API key + verified sender ("Name <mail@domain>") to email download links. Optional. */
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

export type AdminUser = { id: number; username: string }

export type AppEnv = {
  Bindings: Bindings
  Variables: { admin: AdminUser }
}
