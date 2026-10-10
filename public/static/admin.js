/* EcoCraft Digital — back office SPA. Talks only to /api/admin/*; no inline handlers (strict CSP). */
'use strict'

const $ = (sel, root = document) => root.querySelector(sel)
const root = $('#root')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const money = (n) => '₪' + Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 })
const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const STATUS = { pending: 'ממתינה לתשלום', paid: 'שולמה', delivered: 'נשלחה ללקוח', cancelled: 'בוטלה', refunded: 'הוחזרה' }
const pill = (st) => `<span class="pill ${esc(st)}">${esc(STATUS[st] || st)}</span>`

const state = { view: 'dashboard', session: null, user: null, cache: {} }

/* ------------------------------------------------------------------ api */
async function api(method, path, body, raw) {
  const opts = { method, headers: { 'X-Requested-With': 'ecocraft' }, credentials: 'same-origin' }
  if (raw) {
    Object.assign(opts.headers, raw.headers)
    opts.body = raw.body
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch('/api/admin' + path, opts)
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/login') {
    state.user = null
    render()
    throw new Error('פג תוקף ההתחברות')
  }
  if (!res.ok || data.success === false) throw new Error(data.error || 'שגיאה לא צפויה')
  return data
}

let toastTimer
function toast(msg, isErr) {
  const t = $('#toast')
  t.textContent = msg
  t.className = 'toast show' + (isErr ? ' err' : '')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.className = 'toast'), 3200)
}
const guard = (fn) => async (...a) => {
  try {
    return await fn(...a)
  } catch (e) {
    toast(e.message, true)
  }
}

/* ---------------------------------------------------------------- shell */
const NAV = [
  ['dashboard', 'דשבורד', '📊'],
  ['orders', 'הזמנות', '🧾'],
  ['products', 'מוצרים', '🛍️'],
  ['categories', 'קטגוריות', '🗂️'],
  ['customers', 'לקוחות', '👥'],
  ['pages', 'עמודים', '📄'],
  ['messages', 'פניות', '📨'],
  ['content', 'תוכן האתר', '🎨'],
  ['settings', 'הגדרות', '⚙️']
]

async function boot() {
  const s = await fetch('/api/admin/session', { credentials: 'same-origin' }).then((r) => r.json())
  state.session = s
  state.user = s.authenticated ? s.username : null
  render()
}

function render() {
  if (!state.user) return renderAuth()
  root.innerHTML = `<div class="shell"><nav class="side">
    <div class="brand"><b>ED</b> בק אופיס</div>
    ${NAV.map(([id, label, ic]) => `<button class="nav ${state.view === id ? 'active' : ''}" data-act="nav" data-view="${id}"><span>${ic}</span>${label}</button>`).join('')}
    <div class="spacer"></div>
    <a class="nav" href="/" target="_blank" rel="noopener"><span>↗</span>צפייה באתר</a>
    <button class="nav" data-act="logout"><span>⎋</span>יציאה (${esc(state.user)})</button>
  </nav><main class="main" id="main"></main></div>`
  views[state.view]()
}

const main = () => $('#main')
const goto = (view) => {
  state.view = view
  render()
}

/* ----------------------------------------------------------------- auth */
function renderAuth() {
  const setup = state.session?.needsSetup
  root.innerHTML = `<div class="auth"><div class="card">
    <h1>${setup ? 'הגדרת מנהלת ראשונה' : 'כניסה לניהול'}</h1>
    <p class="muted">${setup ? 'צרי את חשבון הניהול הראשון. נדרש קוד ההתקנה (SETUP_TOKEN) שהוגדר בשרת.' : 'EcoCraft Digital · בק אופיס'}</p>
    <form id="authForm" autocomplete="on">
      ${setup ? '<div class="field"><label>קוד התקנה</label><input type="password" name="token" required autocomplete="off"></div><div class="field"><label>אימייל</label><input type="email" name="email" required autocomplete="email"></div>' : ''}
      <div class="field"><label>שם משתמש</label><input type="text" name="username" required autocomplete="username" autofocus></div>
      <div class="field"><label>סיסמה${setup ? ' (לפחות 10 תווים)' : ''}</label><input type="password" name="password" required minlength="${setup ? 10 : 1}" autocomplete="${setup ? 'new-password' : 'current-password'}"></div>
      <button class="btn primary" style="width:100%" type="submit">${setup ? 'יצירת חשבון' : 'כניסה'}</button>
    </form></div></div>`
  $('#authForm').onsubmit = guard(async (e) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target))
    await api('POST', setup ? '/setup' : '/login', body)
    await boot()
  })
}

/* ---------------------------------------------------------------- views */
const views = {
  dashboard: guard(async function () {
    main().innerHTML = '<p class="muted">טוען…</p>'
    const d = await api('GET', '/dashboard')
    const t = d.totals
    const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`
    main().innerHTML = `<div class="head"><h1>דשבורד</h1></div>
      <div class="kpis">${kpi(money(t.revenue_30d), 'הכנסות ב-30 ימים')}${kpi(money(t.revenue_total), 'הכנסות סה"כ')}${kpi(t.orders_paid, 'הזמנות ששולמו')}
        ${kpi(t.orders_pending, 'ממתינות לתשלום')}${kpi(t.customers, 'לקוחות')}${kpi(t.products_active, 'מוצרים פעילים')}</div>
      <div class="two"><div class="card"><h3>הכנסות – 30 הימים האחרונים</h3>${chart(d.series)}</div>
        <div class="card"><h3>הנמכרים ביותר</h3>${d.topProducts.length ? `<ul class="toplist">${d.topProducts.map((p) => `<li><span>${esc(p.name)}</span><b>${p.units} · ${money(p.revenue)}</b></li>`).join('')}</ul>` : '<p class="muted">עדיין אין מכירות.</p>'}</div></div>
      <div class="card"><h3>הזמנות אחרונות</h3>${d.recentOrders.length ? `<div class="tbl-wrap"><table><tbody>${d.recentOrders
        .map((o) => `<tr class="click" data-act="order" data-id="${o.id}"><td>#${o.id}</td><td>${esc(o.customer_name)}</td><td>${money(o.total_amount)}</td><td>${pill(o.status)}</td><td class="muted small">${fmtDate(o.created_at)}</td></tr>`)
        .join('')}</tbody></table></div>` : '<p class="muted">אין הזמנות עדיין.</p>'}</div>`
  }),

  orders: guard(async function () {
    const f = (state.cache.orderFilter ||= { status: '', q: '' })
    const d = await api('GET', `/orders?status=${encodeURIComponent(f.status)}&q=${encodeURIComponent(f.q)}`)
    main().innerHTML = `<div class="head"><h1>הזמנות</h1><span class="grow"></span>
      <input type="text" id="orderSearch" placeholder="חיפוש שם / אימייל / מספר" value="${esc(f.q)}" style="max-width:260px"></div>
      <div class="tabs">${[['', 'הכל'], ...Object.entries(STATUS)].map(([k, v]) => `<button class="${f.status === k ? 'on' : ''}" data-act="orderFilter" data-status="${k}">${v}</button>`).join('')}</div>
      ${d.orders.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>לקוח</th><th>פריטים</th><th>סכום</th><th>סטטוס</th><th>נוצרה</th></tr></thead><tbody>${d.orders
        .map((o) => `<tr class="click" data-act="order" data-id="${o.id}"><td>#${o.id}</td><td>${esc(o.customer_name)}<div class="muted small">${esc(o.customer_email)}</div></td><td>${o.items}</td><td>${money(o.total_amount)}</td><td>${pill(o.status)}</td><td class="muted small nowrap">${fmtDate(o.created_at)}</td></tr>`)
        .join('')}</tbody></table></div><p class="muted small">${d.total} הזמנות</p>` : '<div class="card empty">לא נמצאו הזמנות.</div>'}`
    const s = $('#orderSearch')
    s.onkeydown = (e) => {
      if (e.key === 'Enter') {
        f.q = s.value.trim()
        views.orders()
      }
    }
  }),

  products: guard(async function () {
    const [p, c] = await Promise.all([api('GET', '/products'), api('GET', '/categories')])
    state.cache.products = p.products
    state.cache.categories = c.categories
    const cat = (id) => c.categories.find((x) => x.id === id)?.name || '—'
    main().innerHTML = `<div class="head"><h1>מוצרים</h1><span class="grow"></span><button class="btn primary" data-act="productNew">+ מוצר חדש</button></div>
      ${p.products.length ? `<div class="tbl-wrap"><table><thead><tr><th></th><th>שם</th><th>קטגוריה</th><th>מחיר</th><th>סטטוס</th><th></th></tr></thead><tbody>${p.products
        .map((x) => `<tr><td>${thumb(x)}</td><td><b>${esc(x.name)}</b><div class="muted small">${esc(x.slug)}</div></td><td>${esc(cat(x.category_id))}</td>
          <td>${money(x.price)}${x.old_price ? `<div class="muted small"><s>${money(x.old_price)}</s></div>` : ''}</td>
          <td>${x.active ? '<span class="pill paid">פעיל</span>' : '<span class="pill off">מוסתר</span>'}</td>
          <td><div class="actions"><button class="btn ghost sm" data-act="productEdit" data-id="${x.id}">עריכה</button><button class="btn danger sm" data-act="productDelete" data-id="${x.id}">מחיקה</button></div></td></tr>`)
        .join('')}</tbody></table></div>` : '<div class="card empty">אין מוצרים עדיין.</div>'}`
  }),

  categories: guard(async function () {
    const c = await api('GET', '/categories')
    state.cache.catDraft = c.categories.map((x) => ({ ...x }))
    renderCategories()
  }),

  customers: guard(async function () {
    const q = state.cache.custQ || ''
    const d = await api('GET', `/customers?q=${encodeURIComponent(q)}`)
    main().innerHTML = `<div class="head"><h1>לקוחות</h1><span class="grow"></span><input type="text" id="custSearch" placeholder="חיפוש שם / אימייל" value="${esc(q)}" style="max-width:260px"></div>
      ${d.customers.length ? `<div class="tbl-wrap"><table><thead><tr><th>שם</th><th>אימייל</th><th>טלפון</th><th>הזמנות</th><th>סה"כ רכישות</th><th>הזמנה אחרונה</th></tr></thead><tbody>${d.customers
        .map((x) => `<tr><td><b>${esc(x.name)}</b></td><td><a href="mailto:${esc(x.email)}">${esc(x.email)}</a></td><td>${esc(x.phone || '—')}</td><td>${x.orders}</td><td>${money(x.total_spent)}</td><td class="muted small nowrap">${fmtDate(x.last_order_at)}</td></tr>`)
        .join('')}</tbody></table></div>` : '<div class="card empty">אין לקוחות עדיין.</div>'}`
    const s = $('#custSearch')
    s.onkeydown = (e) => {
      if (e.key === 'Enter') {
        state.cache.custQ = s.value.trim()
        views.customers()
      }
    }
  }),

  pages: guard(async function () {
    const { pages } = await api('GET', '/pages')
    state.cache.pages = pages
    const SYS = ['faq', 'terms', 'privacy', 'refunds']
    const href = (p) => (SYS.includes(p.slug) ? '/' + p.slug : '/page/' + p.slug)
    main().innerHTML = `<div class="head"><h1>עמודים</h1><span class="grow"></span><button class="btn primary" data-act="pageNew">+ עמוד חדש</button></div>
      <p class="muted">שאלות נפוצות, תקנון, פרטיות והחזרים. עמוד שמסומן "טיוטה" לא מוצג באתר ולא מקושר מהפוטר. עמודי התקנון הם נוסח פתיחה בלבד — יש להשלים את הסעיפים שמסומנים [להשלים] ולהעביר לבדיקה משפטית לפני פרסום.</p>
      <div class="tbl-wrap"><table><thead><tr><th>עמוד</th><th>כתובת</th><th>סטטוס</th><th></th></tr></thead><tbody>${pages.map((p) => `<tr><td><b>${esc(p.title)}</b>${/\[להשלים|\{\{\w+\}\}/.test(p.body) ? '<div class="small" style="color:var(--warn)">יש סעיפים להשלמה</div>' : ''}</td><td dir="ltr" class="small">${esc(href(p))}</td>
        <td>${p.published ? '<span class="pill paid">מפורסם</span>' : '<span class="pill pending">טיוטה</span>'}</td>
        <td><div class="actions">${p.published ? `<a class="btn ghost sm" href="${esc(href(p))}" target="_blank" rel="noopener">צפייה</a>` : ''}<button class="btn ghost sm" data-act="pageEdit" data-slug="${esc(p.slug)}">עריכה</button>${SYS.includes(p.slug) ? '' : `<button class="btn danger sm" data-act="pageDelete" data-slug="${esc(p.slug)}">מחיקה</button>`}</div></td></tr>`).join('')}</tbody></table></div>`
  }),

  messages: guard(async function () {
    const { messages } = await api('GET', '/messages')
    main().innerHTML = `<div class="head"><h1>פניות מהאתר</h1></div>
      ${messages.length ? messages.map((m) => `<div class="card" style="${m.handled ? 'opacity:.6' : ''}"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b>${esc(m.name)}</b> <a href="mailto:${esc(m.email)}" dir="ltr">${esc(m.email)}</a>${m.order_ref ? `<span class="pill">הזמנה: ${esc(m.order_ref)}</span>` : ''}<span class="muted small">${fmtDate(m.created_at)}</span><span class="grow" style="flex:1"></span>
        <button class="btn ghost sm" data-act="messageDone" data-id="${m.id}" data-handled="${m.handled ? 0 : 1}">${m.handled ? 'סימון כלא טופלה' : 'סימון כטופלה'}</button></div><p style="white-space:pre-wrap;margin:0">${esc(m.message)}</p></div>`).join('') : '<div class="card empty">אין פניות.</div>'}`
  }),

  content: guard(async function () {
    const [d, p] = await Promise.all([api('GET', '/design'), api('GET', '/products')])
    state.cache.design = d.design
    state.cache.products = p.products
    renderDesign()
  }),

  settings() {
    main().innerHTML = `<div class="head"><h1>הגדרות</h1></div><div class="card" style="max-width:480px"><h3>החלפת סיסמה</h3>
      <form id="pwForm"><div class="field"><label>סיסמה נוכחית</label><input type="password" name="current" required autocomplete="current-password"></div>
      <div class="field"><label>סיסמה חדשה (לפחות 10 תווים)</label><input type="password" name="next" required minlength="10" autocomplete="new-password"></div>
      <button class="btn primary" type="submit">עדכון סיסמה</button></form></div>`
    $('#pwForm').onsubmit = guard(async (e) => {
      e.preventDefault()
      await api('POST', '/password', Object.fromEntries(new FormData(e.target)))
      e.target.reset()
      toast('הסיסמה עודכנה ✓')
    })
  }
}

/* --------------------------------------------------------------- pieces */
function thumb(p) {
  if (p.image_url) return `<img class="thumb" src="${esc(p.image_url)}" alt="">`
  const g = `linear-gradient(135deg,${esc(p.cover_from || '#6E8767')},${esc(p.cover_to || '#4F634A')})`
  return `<div class="thumb gen" style="background:${g}">${esc((p.cover_title || p.name).slice(0, 14))}</div>`
}

function chart(series) {
  const days = []
  const byDay = Object.fromEntries(series.map((r) => [r.day, r]))
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    days.push({ day: d, revenue: byDay[d]?.revenue || 0, orders: byDay[d]?.orders || 0 })
  }
  const max = Math.max(1, ...days.map((d) => d.revenue))
  const w = 600, h = 160, bw = w / days.length
  const bars = days
    .map((d, i) => {
      const bh = Math.max(d.revenue ? 3 : 0, (d.revenue / max) * (h - 8))
      return `<rect class="bar" x="${(i * bw + 2).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="3"><title>${d.day}: ${money(d.revenue)} (${d.orders} הזמנות)</title></rect>`
    })
    .join('')
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="הכנסות יומיות">${bars}</svg>
    <div class="chart-axis"><span>${days[0].day.slice(5)}</span><span>${days[29].day.slice(5)}</span></div>`
}

function imagePicker(name, url) {
  return `<div class="img-pick"><div class="prev" data-prev="${name}">${url ? `<img src="${esc(url)}" alt="">` : ''}</div>
    <div class="ctl"><input type="text" name="${name}" value="${esc(url || '')}" placeholder="/media/… או https://…" dir="ltr">
    <div><label class="btn ghost sm">העלאת תמונה<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload="${name}" hidden></label>
    <span class="hint">PNG / JPG / WEBP / GIF עד 1.5MB</span></div></div></div>`
}

function modal(html) {
  closeModal()
  const el = document.createElement('div')
  el.className = 'modal-back'
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`
  el.addEventListener('mousedown', (e) => e.target === el && closeModal())
  document.body.appendChild(el)
  return el
}
const closeModal = () => document.querySelector('.modal-back')?.remove()

/* ---------------------------------------------------------------- orders */
async function openOrder(id) {
  const { order: o } = await api('GET', `/orders/${id}`)
  const mail = o.downloadUrl
    ? `mailto:${o.customer_email}?subject=${encodeURIComponent('ההזמנה שלך מ-EcoCraft Digital')}&body=${encodeURIComponent(`שלום ${o.customer_name},\nתודה על הרכישה! הקבצים שלך זמינים להורדה כאן:\n${o.downloadUrl}\n`)}`
    : ''
  const el = modal(`<h3>הזמנה #${o.id} ${pill(o.status)}</h3>
    <dl class="kv"><dt>לקוח</dt><dd>${esc(o.customer_name)}</dd><dt>אימייל</dt><dd><a href="mailto:${esc(o.customer_email)}">${esc(o.customer_email)}</a></dd>
    <dt>טלפון</dt><dd>${esc(o.customer_phone || '—')}</dd><dt>נוצרה</dt><dd>${fmtDate(o.created_at)}</dd><dt>שולמה</dt><dd>${fmtDate(o.paid_at)}</dd><dt>PayPal</dt><dd>${o.paypal_capture_id ? 'אושר אוטומטית · ' + esc(o.paypal_capture_id) : o.paypal_order_id ? 'ממתין לאישור לקוח' : 'ידני'}</dd></dl>
    <div class="tbl-wrap" style="margin-bottom:14px"><table><tbody>${o.items.map((i) => `<tr><td>${esc(i.product_name)}</td><td>× ${i.quantity}</td><td>${money(i.price * i.quantity)}</td></tr>`).join('')}
      <tr><td colspan="2"><b>סה"כ</b></td><td><b>${money(o.total_amount)}</b></td></tr></tbody></table></div>
    <div class="row"><div class="field"><label>סטטוס</label><select id="ordStatus">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <div class="field"><label>הערות פנימיות</label><textarea id="ordNotes" style="min-height:70px">${esc(o.notes)}</textarea></div>
    ${o.downloadUrl ? `<div class="field"><label>קישור הורדה ללקוח <span class="muted small">(פעיל כל עוד ההזמנה שולמה / נשלחה)</span></label>
      <div class="dl-link"><input type="text" readonly value="${esc(o.downloadUrl)}" id="dlUrl"><button class="btn ghost sm" data-act="copy" data-target="dlUrl">העתקה</button></div>
      <p style="margin:10px 0 0"><a class="btn ghost sm" href="${esc(mail)}">✉ שליחה במייל ללקוח</a></p></div>` : '<p class="hint">קישור הורדה נוצר אוטומטית ברגע שמסמנים את ההזמנה כ"שולמה".</p>'}
    <div class="actions" style="margin-top:16px"><button class="btn ghost" data-act="closeModal">סגירה</button><button class="btn primary" data-act="orderSave" data-id="${o.id}">שמירה</button></div>`)
  return el
}

/* ------------------------------------------------------------ categories */
function renderCategories() {
  const list = state.cache.catDraft
  main().innerHTML = `<div class="head"><h1>קטגוריות</h1></div><div class="card" style="max-width:640px">
    ${list.map((c, i) => `<div class="list-row"><input type="text" class="grow" data-cat="${i}" value="${esc(c.name)}" placeholder="שם הקטגוריה">
      <span class="muted small">${c.products ?? 0} מוצרים</span>
      <button class="btn ghost sm" data-act="catMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="למעלה">↑</button>
      <button class="btn ghost sm" data-act="catMove" data-i="${i}" data-d="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="למטה">↓</button>
      <button class="btn danger sm" data-act="catDelete" data-i="${i}" aria-label="מחיקה">✕</button></div>`).join('') || '<p class="muted">אין קטגוריות.</p>'}
    <div style="display:flex;gap:10px;margin-top:12px"><button class="btn ghost" data-act="catAdd">+ קטגוריה</button><button class="btn primary" data-act="catSave">שמירה</button></div>
    <p class="hint">מחיקת קטגוריה לא מוחקת מוצרים — הם יישארו בלי קטגוריה.</p></div>`
}
function syncCategories() {
  document.querySelectorAll('[data-cat]').forEach((el) => (state.cache.catDraft[+el.dataset.cat].name = el.value))
}

/* -------------------------------------------------------------- products */
function productForm(p) {
  const isNew = !p.id
  const cats = state.cache.categories
  const f = (label, name, val, extra = '') => `<div class="field"><label>${label}</label><input type="text" name="${name}" value="${esc(val ?? '')}" ${extra}></div>`
  main().innerHTML = `<div class="head"><h1>${isNew ? 'מוצר חדש' : 'עריכת מוצר'}</h1></div>
    <form id="productForm" data-id="${p.id || ''}">
    <div class="card"><h3>פרטים</h3>
      <div class="row">${f('שם המוצר *', 'name', p.name, 'required maxlength="200"')}
        <div class="field"><label>קטגוריה</label><select name="category_id"><option value="">— ללא —</option>${cats.map((c) => `<option value="${esc(c.id)}" ${p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        ${f('מזהה (slug) באנגלית', 'slug', p.slug, 'dir="ltr" placeholder="נוצר אוטומטית"')}</div>
      <div class="field"><label>תיאור קצר</label><input type="text" name="short_description" value="${esc(p.short_description)}" maxlength="500"></div>
      <div class="field"><label>תיאור מלא</label><textarea name="description" style="min-height:130px">${esc(p.description)}</textarea></div>
      <div class="field"><label>מה כלול (שורה לכל פריט)</label><textarea name="includes">${esc((p.includes || []).join('\n'))}</textarea></div></div>
    <div class="card"><h3>מחיר ותצוגה</h3><div class="row">
      <div class="field"><label>מחיר (₪) *</label><input type="number" name="price" min="0" step="0.01" required value="${esc(p.price ?? '')}"></div>
      <div class="field"><label>מחיר קודם (מחוק)</label><input type="number" name="old_price" min="0" step="0.01" value="${esc(p.old_price ?? '')}"></div>
      ${f('תגית (למשל "חדש")', 'tag', p.tag, 'maxlength="40"')}
      <div class="field"><label>צבע תגית</label><select name="tag_type"><option value="rose" ${p.tag_type !== 'sage' ? 'selected' : ''}>ורוד</option><option value="sage" ${p.tag_type === 'sage' ? 'selected' : ''}>ירוק</option></select></div>
      <div class="field"><label>דירוג (0–5)</label><input type="number" name="rating" min="0" max="5" step="0.5" value="${esc(p.rating ?? 5)}"></div>
      <div class="field"><label>מספר ביקורות</label><input type="number" name="reviews" min="0" step="1" value="${esc(p.reviews ?? 0)}"></div>
      <div class="field"><label>סדר תצוגה</label><input type="number" name="sort_order" step="1" value="${esc(p.sort_order ?? 0)}"></div></div>
      <label class="check"><input type="checkbox" name="active" ${p.active !== 0 ? 'checked' : ''}> מוצר פעיל (מוצג בחנות)</label></div>
    <div class="card"><h3>תמונה</h3><div class="field">${imagePicker('image_url', p.image_url)}</div>
      <p class="hint">אם אין תמונה, החנות מציגה עטיפה צבעונית:</p>
      <div class="row">${f('כותרת עטיפה', 'cover_title', p.cover_title, 'maxlength="100"')}${f('כותרת משנה', 'cover_sub', p.cover_sub, 'maxlength="100"')}
      <div class="field"><label>צבע התחלה</label><input type="color" name="cover_from" value="${esc(p.cover_from || '#6E8767')}"></div>
      <div class="field"><label>צבע סיום</label><input type="color" name="cover_to" value="${esc(p.cover_to || '#4F634A')}"></div></div></div>
    <div class="card"><h3>תשלום ומסירה</h3>
      <div class="field"><label>קישור תשלום PayPal</label><input type="url" name="paypal_url" dir="ltr" placeholder="https://paypal.me/…/49" value="${esc(p.paypal_url)}"></div>
      <div class="field"><label>קובץ דיגיטלי להורדה (פרטי — נמסר רק אחרי אישור תשלום)</label>
        <input type="hidden" name="file_id" value="${esc(p.file_id || '')}">
        <div class="img-pick"><div class="ctl"><div id="fileName" class="small">${p.file_id ? '📎 ' + esc(p.file_name || 'קובץ מצורף') : '<span class="muted">לא הועלה קובץ</span>'}</div>
          <div><label class="btn ghost sm">העלאת קובץ<input type="file" data-upload-file hidden></label>
          ${p.file_id ? '<button type="button" class="btn danger sm" data-act="fileRemove">הסרה</button>' : ''} <span class="hint">עד 1.9MB</span></div></div></div>
        <div style="margin-top:10px"><label class="lbl">או קישור חיצוני (Drive / Dropbox / …)</label><input type="url" name="file_url" dir="ltr" placeholder="https://…" value="${esc(p.file_url)}"></div></div></div>
    <div class="sticky-save"><button class="btn primary" type="submit">שמירה</button><button class="btn ghost" type="button" data-act="nav" data-view="products">ביטול</button></div></form>`
  $('#productForm').onsubmit = guard(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.includes = String(body.includes || '').split('\n').map((x) => x.trim()).filter(Boolean)
    body.active = fd.has('active')
    const id = e.target.dataset.id
    await api(id ? 'PUT' : 'POST', id ? `/products/${id}` : '/products', body)
    toast('נשמר ✓')
    goto('products')
  })
}

/* ---------------------------------------------------------------- design */
const ICONS = [['bolt', '⚡ ברק'], ['heart', '❤ לב'], ['globe', '🌐 גלובוס'], ['star', '★ כוכב'], ['gift', '🎁 מתנה']]
const SECTION_NAMES = { featured: 'מוצרים נבחרים', categories: 'קטגוריות', about: 'סיפור המותג (אודות)', info: 'איך זה עובד (הורדה ותמיכה)', cta: 'קריאה לפעולה', features: 'יתרונות (טקסט חופשי)' }

function renderDesign() {
  const d = state.cache.design
  const c = d.colors || {}
  const t = (label, name, val, extra = '') => `<div class="field"><label>${label}</label><input type="text" name="${name}" value="${esc(val ?? '')}" ${extra}></div>`
  const color = (label, k) => `<div class="field"><label>${label}</label><input type="color" name="color_${k}" value="${esc(c[k] || '#000000')}"></div>`
  main().innerHTML = `<div class="head"><h1>תוכן האתר</h1><span class="grow"></span><a class="btn ghost" href="/" target="_blank" rel="noopener">צפייה באתר ↗</a></div>
  <form id="designForm">
    <div class="card"><h3>מותג</h3><div class="row">${t('שם החנות', 'brandName', d.brandName)}${t('תת-כותרת', 'brandSub', d.brandSub)}${t('אותיות לוגו', 'logoText', d.logoText, 'maxlength="4"')}${t('סימן מטבע', 'currency', d.currency, 'maxlength="4"')}
      <div class="field"><label>גופן כותרות</label><select name="headingFont">${['Frank Ruhl Libre', 'Assistant', 'Heebo'].map((f) => `<option ${d.headingFont === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>
      <div class="row">${color('ירוק', 'sage')}${color('ירוק עמוק', 'sageDeep')}${color('ורוד', 'rose')}${color('רקע', 'cream')}${color('טקסט', 'ink')}</div></div>
    <div class="card"><h3>באנר ראשי</h3><div class="row">
      <div class="field"><label>סגנון</label><select name="heroStyle">${[['side', 'תמונה בצד'], ['center', 'ממורכז'], ['bg', 'תמונת רקע']].map(([k, v]) => `<option value="${k}" ${d.heroStyle === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      ${t('שורה עליונה', 'heroEyebrow', d.heroEyebrow)}${t('כותרת', 'heroTitle', d.heroTitle)}${t('כותרת משנה (אנגלית)', 'heroSubtitle', d.heroSubtitle)}${t('תגית בתמונה', 'heroBadge', d.heroBadge)}${t('תת-תגית', 'heroBadgeSub', d.heroBadgeSub)}</div>
      <div class="field"><label>טקסט פתיחה</label><textarea name="heroLead">${esc(d.heroLead)}</textarea></div>
      <div class="field"><label>תמונה</label>${imagePicker('heroImg', d.heroImg)}</div>
      <div class="field"><label>שבבי אמון (שורה לכל שבב)</label><textarea name="trust" style="min-height:80px">${esc((d.trust || []).join('\n'))}</textarea></div></div>
    <div class="card"><h3>סדר וסקשנים בדף הבית</h3>
      ${(d.homeSections || []).map((s, i) => `<div class="list-row"><label class="check grow"><input type="checkbox" data-section="${s.id}" ${s.on ? 'checked' : ''}> ${SECTION_NAMES[s.id] || s.id}</label>
        <button type="button" class="btn ghost sm" data-act="sectionMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn ghost sm" data-act="sectionMove" data-i="${i}" data-d="1" ${i === d.homeSections.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('')}</div>
    <div class="card"><h3>מוצרים נבחרים</h3><div class="row">${t('כותרת', 'featuredTitle', d.featuredTitle)}${t('תיאור', 'featuredSub', d.featuredSub)}</div>
      <div class="lbl">אילו מוצרים להציג בדף הבית (אם לא נבחר דבר — שלושת הראשונים)</div>
      ${state.cache.products.map((p) => `<label class="check" style="margin-bottom:6px"><input type="checkbox" name="featured" value="${esc(p.slug)}" ${(d.featuredIds || []).includes(p.slug) ? 'checked' : ''}> ${esc(p.name)} ${p.active ? '' : '<span class="pill off">מוסתר</span>'}</label>`).join('')}</div>
    <div class="card"><h3>יתרונות</h3>
      ${(d.features || []).map((f, i) => `<div class="feat-edit"><div class="row"><div class="field"><label>אייקון</label><select data-f="icon" data-i="${i}">${ICONS.map(([k, v]) => `<option value="${k}" ${f.icon === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>כותרת</label><input type="text" data-f="title" data-i="${i}" value="${esc(f.title)}"></div></div>
        <div class="field"><label>תיאור</label><input type="text" data-f="body" data-i="${i}" value="${esc(f.body)}"></div>
        <button type="button" class="btn danger sm" data-act="featDelete" data-i="${i}">הסרה</button></div>`).join('')}
      ${(d.features || []).length < 6 ? '<button type="button" class="btn ghost" data-act="featAdd">+ יתרון</button>' : ''}</div>
    <div class="card"><h3>אודות ופוטר</h3><div class="row">${t('כותרת', 'aboutTitle', d.aboutTitle)}${t('משפט בפוטר', 'footerTagline', d.footerTagline)}</div>
      <div class="field"><label>טקסט (פסקה חדשה = שורה חדשה)</label><textarea name="aboutText" style="min-height:130px">${esc(d.aboutText)}</textarea></div>
      <div class="field"><label>תמונה</label>${imagePicker('aboutImg', d.aboutImg)}</div></div>
    <div class="card"><h3>עמוד "עלינו" — פרקים נוספים</h3><p class="hint" style="margin-top:-8px">כל פרק מופיע בעמוד "עלינו" (למשל: הסיפור שלנו, מה חשוב לנו, איך נוצר מוצר). כתבי רק דברים אמיתיים.</p>
      ${(d.aboutSections || []).map((x, i) => `<div class="feat-edit"><div class="field"><label>כותרת הפרק</label><input type="text" data-as="title" data-i="${i}" value="${esc(x.title)}" maxlength="120"></div>
        <div class="field"><label>טקסט</label><textarea data-as="body" data-i="${i}" maxlength="3000">${esc(x.body)}</textarea></div>
        <button type="button" class="btn danger sm" data-act="aboutDelete" data-i="${i}">הסרה</button></div>`).join('')}
      ${(d.aboutSections || []).length < 8 ? '<button type="button" class="btn ghost" data-act="aboutAdd">+ פרק</button>' : ''}</div>
    <div class="card"><h3>פרטי קשר ועסק</h3><p class="hint" style="margin-top:-8px">מופיעים בעמוד "צור קשר", בפוטר ובעמודים המשפטיים. שדה ריק לא יוצג.</p>
      <div class="row">${t('אימייל', 'contactEmail', d.contactEmail, 'type="email" dir="ltr"')}${t('טלפון / וואטסאפ', 'contactPhone', d.contactPhone, 'dir="ltr"')}${t('קישור לערוץ וואטסאפ', 'whatsappUrl', d.whatsappUrl, 'dir="ltr" placeholder="https://whatsapp.com/channel/…"')}${t('קישור לאינסטגרם', 'instagramUrl', d.instagramUrl, 'dir="ltr" placeholder="https://instagram.com/…"')}
      ${t('שם העסק (לתקנון)', 'businessName', d.businessName)}${t('עוסק מורשה / פטור (מספר)', 'businessId', d.businessId)}</div></div>
    <div class="sticky-save"><button class="btn primary" type="submit">שמירה ופרסום</button></div></form>`
  $('#designForm').onsubmit = guard(async (e) => {
    e.preventDefault()
    await api('PUT', '/design', readDesign())
    toast('האתר עודכן ✓')
    views.content()
  })
}

/** Reads the whole design form back into a design object (also used before structural re-renders). */
function readDesign() {
  const form = $('#designForm')
  const fd = new FormData(form)
  const d = { ...state.cache.design }
  for (const k of ['brandName', 'brandSub', 'logoText', 'currency', 'headingFont', 'heroStyle', 'heroEyebrow', 'heroTitle', 'heroSubtitle', 'heroBadge', 'heroBadgeSub', 'heroLead', 'heroImg', 'featuredTitle', 'featuredSub', 'aboutTitle', 'aboutText', 'aboutImg', 'footerTagline', 'contactEmail', 'contactPhone', 'whatsappUrl', 'instagramUrl', 'businessName', 'businessId']) d[k] = fd.get(k) ?? ''
  d.colors = Object.fromEntries(['sage', 'sageDeep', 'rose', 'cream', 'ink'].map((k) => [k, fd.get('color_' + k)]))
  d.trust = String(fd.get('trust') || '').split('\n').map((x) => x.trim()).filter(Boolean)
  d.featuredIds = fd.getAll('featured')
  d.homeSections = (d.homeSections || []).map((s) => ({ id: s.id, on: !!form.querySelector(`[data-section="${s.id}"]`)?.checked }))
  d.aboutSections = (d.aboutSections || []).map((x, i) => ({
    title: form.querySelector(`[data-as="title"][data-i="${i}"]`).value,
    body: form.querySelector(`[data-as="body"][data-i="${i}"]`).value
  }))
  d.features = (d.features || []).map((f, i) => ({
    icon: form.querySelector(`[data-f="icon"][data-i="${i}"]`).value,
    title: form.querySelector(`[data-f="title"][data-i="${i}"]`).value,
    body: form.querySelector(`[data-f="body"][data-i="${i}"]`).value
  }))
  return d
}

/* ---------------------------------------------------------------- pages */
function pageForm(p) {
  main().innerHTML = `<div class="head"><h1>${p.isNew ? 'עמוד חדש' : 'עריכת עמוד'}</h1></div><form id="pageForm" data-slug="${esc(p.slug)}" data-new="${p.isNew ? 1 : ''}">
    <div class="card"><div class="row">${p.isNew ? '<div class="field"><label>מזהה (כתובת: /page/…)</label><input type="text" name="slug" dir="ltr" placeholder="my-page" required></div>' : ''}
      <div class="field"><label>כותרת</label><input type="text" name="title" value="${esc(p.title)}" maxlength="150" required></div></div>
      <div class="field"><label>תוכן</label><textarea name="body" style="min-height:360px" dir="rtl">${esc(p.body)}</textarea>
        <p class="hint">כותרת משנה: <code>## כותרת</code> · רשימה: <code>- פריט</code> · תיבה מודגשת: <code>&gt; טקסט</code> · שורה ריקה = פסקה חדשה. אפשר להשתמש ב-<code>{{businessName}}</code>, <code>{{businessId}}</code>, <code>{{contactEmail}}</code>, <code>{{siteUrl}}</code> — הם יתמלאו מ"פרטי קשר ועסק" בעריכת תוכן האתר.</p></div>
      <label class="check"><input type="checkbox" name="published" ${p.published ? 'checked' : ''}> מפורסם באתר</label></div>
    <div class="sticky-save"><button class="btn primary" type="submit">שמירה</button><button class="btn ghost" type="button" data-act="nav" data-view="pages">ביטול</button></div></form>`
  $('#pageForm').onsubmit = guard(async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const slug = e.target.dataset.new ? String(fd.get('slug') || '').trim().toLowerCase() : e.target.dataset.slug
    await api('PUT', `/pages/${encodeURIComponent(slug)}`, { title: fd.get('title'), body: fd.get('body'), published: fd.has('published') })
    toast('נשמר ✓')
    views.pages()
  })
}

/* -------------------------------------------------------------- actions */
const actions = {
  nav: (el) => goto(el.dataset.view),
  logout: guard(async () => {
    await api('POST', '/logout')
    state.user = null
    await boot()
  }),
  closeModal,
  order: guard((el) => openOrder(el.dataset.id)),
  orderFilter: (el) => {
    state.cache.orderFilter.status = el.dataset.status
    views.orders()
  },
  orderSave: guard(async (el) => {
    await api('PATCH', `/orders/${el.dataset.id}`, { status: $('#ordStatus').value, notes: $('#ordNotes').value })
    closeModal()
    toast('ההזמנה עודכנה ✓')
    views[state.view]()
  }),
  copy: guard(async (el) => {
    const input = document.getElementById(el.dataset.target)
    input.select()
    await navigator.clipboard.writeText(input.value)
    toast('הועתק ✓')
  }),
  productNew: () => productForm({ active: 1, tag_type: 'rose', rating: 5, reviews: 0, sort_order: state.cache.products.length, includes: [] }),
  productEdit: (el) => productForm(state.cache.products.find((p) => p.id === +el.dataset.id)),
  productDelete: guard(async (el) => {
    const p = state.cache.products.find((x) => x.id === +el.dataset.id)
    if (!confirm(`למחוק את "${p.name}"? היסטוריית ההזמנות תישמר.`)) return
    await api('DELETE', `/products/${p.id}`)
    toast('המוצר נמחק')
    views.products()
  }),
  fileRemove: () => {
    $('#productForm [name=file_id]').value = ''
    $('#fileName').innerHTML = '<span class="muted">לא הועלה קובץ</span>'
  },
  catAdd: () => {
    syncCategories()
    state.cache.catDraft.push({ id: '', name: '', products: 0 })
    renderCategories()
  },
  catDelete: (el) => {
    syncCategories()
    const c = state.cache.catDraft[+el.dataset.i]
    if (c.products && !confirm(`בקטגוריה "${c.name}" יש ${c.products} מוצרים. הם יישארו בלי קטגוריה. להמשיך?`)) return
    state.cache.catDraft.splice(+el.dataset.i, 1)
    renderCategories()
  },
  catMove: (el) => {
    syncCategories()
    const l = state.cache.catDraft, i = +el.dataset.i, j = i + +el.dataset.d
    ;[l[i], l[j]] = [l[j], l[i]]
    renderCategories()
  },
  catSave: guard(async () => {
    syncCategories()
    await api('PUT', '/categories', { categories: state.cache.catDraft.map(({ id, name }) => ({ id, name })) })
    toast('הקטגוריות נשמרו ✓')
    views.categories()
  }),
  sectionMove: (el) => {
    state.cache.design = readDesign()
    const l = state.cache.design.homeSections, i = +el.dataset.i, j = i + +el.dataset.d
    ;[l[i], l[j]] = [l[j], l[i]]
    renderDesign()
  },
  featAdd: () => {
    state.cache.design = readDesign()
    state.cache.design.features.push({ icon: 'star', title: '', body: '' })
    renderDesign()
  },
  aboutAdd: () => {
    state.cache.design = readDesign()
    ;(state.cache.design.aboutSections ||= []).push({ title: '', body: '' })
    renderDesign()
  },
  aboutDelete: (el) => {
    state.cache.design = readDesign()
    state.cache.design.aboutSections.splice(+el.dataset.i, 1)
    renderDesign()
  },
  pageEdit: (el) => pageForm(state.cache.pages.find((p) => p.slug === el.dataset.slug)),
  pageNew: () => pageForm({ slug: '', title: '', body: '', published: 0, isNew: true }),
  pageDelete: guard(async (el) => {
    if (!confirm('למחוק את העמוד?')) return
    await api('DELETE', `/pages/${encodeURIComponent(el.dataset.slug)}`)
    toast('העמוד נמחק')
    views.pages()
  }),
  messageDone: guard(async (el) => {
    await api('PATCH', `/messages/${el.dataset.id}`, { handled: el.dataset.handled === '1' })
    views.messages()
  }),
  featDelete: (el) => {
    state.cache.design = readDesign()
    state.cache.design.features.splice(+el.dataset.i, 1)
    renderDesign()
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]')
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el)
})

// Uploads: images go to public media, product files to private storage.
document.addEventListener('change', guard(async (e) => {
  const input = e.target
  const file = input.files?.[0]
  if (!file) return
  if (input.dataset.upload) {
    const res = await api('POST', '/media', undefined, { headers: { 'Content-Type': file.type }, body: file })
    const form = input.closest('form')
    form.querySelector(`[name="${input.dataset.upload}"]`).value = res.url
    form.querySelector(`[data-prev="${input.dataset.upload}"]`).innerHTML = `<img src="${esc(res.url)}" alt="">`
    toast('התמונה הועלתה ✓')
  } else if ('uploadFile' in input.dataset) {
    const res = await api('POST', '/files', undefined, {
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
      body: file
    })
    $('#productForm [name=file_id]').value = res.id
    $('#fileName').textContent = '📎 ' + res.filename
    toast('הקובץ הועלה ✓ (לחצי "שמירה" כדי לקשר אותו למוצר)')
  }
  input.value = ''
}))

boot().catch(() => toast('לא ניתן להתחבר לשרת', true))
