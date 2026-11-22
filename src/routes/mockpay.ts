import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { randomToken } from '../lib/crypto'
import { getGateway } from '../lib/gateway'
import { escapeHtml } from '../lib/html'
import { isObject } from '../lib/validate'

/**
 * Test payment page for the mock gateway (ECOMMERCE_SPEC.md, stage 3). It exists only when PAYMENT_GATEWAY=mock;
 * everywhere else both routes answer 404, because "success" here marks an order as paid without any payment.
 */
export const mockPay = new Hono<AppEnv>()

const OUTCOMES = ['success', 'failure', 'delay'] as const
const METHOD_LABELS: Record<string, string> = { card: 'כרטיס אשראי', bit: 'Bit', applePay: 'Apple Pay', googlePay: 'Google Pay' }

mockPay.get('/mock-pay/:id', async (c) => {
  if (getGateway(c.env)?.name !== 'mock') return c.notFound()
  const order = await c.env.DB.prepare('SELECT id, total_amount, status FROM orders WHERE id = ?').bind(c.req.param('id')).first<{ id: number; total_amount: number; status: string }>()
  if (!order) return c.notFound()
  const method = METHOD_LABELS[c.req.query('m') ?? ''] ?? METHOD_LABELS.card
  c.header('X-Robots-Tag', 'noindex')
  c.header('Content-Security-Policy', "frame-ancestors 'self'")
  c.header('Cache-Control', 'no-store')
  return c.html(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>תשלום לדוגמה</title><link rel="stylesheet" href="/static/store.css"></head><body style="background:transparent">
<form class="mock-pay" id="f" data-order="${order.id}" data-status="${escapeHtml(order.status)}">
  <p class="mock-note">שער בדיקה. שום חיוב אמיתי לא מתבצע.</p>
  <div class="field"><label for="n">מספר כרטיס (${escapeHtml(method)})</label><input id="n" inputmode="numeric" autocomplete="off" value="4580 0000 0000 0000" disabled></div>
  <div class="mock-actions">
    <button type="button" class="btn btn-primary" data-o="success">הצלחה: ${escapeHtml(String(order.total_amount))}₪</button>
    <button type="button" class="btn btn-ghost" data-o="failure">כישלון</button>
    <button type="button" class="btn btn-ghost" data-o="delay">הצלחה אחרי עיכוב</button>
  </div>
  <p id="st" role="status" aria-live="polite"></p>
</form>
<script>
(function(){
  var f=document.getElementById('f'),st=document.getElementById('st'),id=f.dataset.order;
  function send(o,token){parent.postMessage({source:'ecocraft-mockpay',outcome:o,token:token||null},location.origin);}
  function run(o){
    f.querySelectorAll('button').forEach(function(b){b.disabled=true;});
    if(o==='delay'){parent.postMessage({source:'ecocraft-mockpay',outcome:'pending'},location.origin);st.textContent='מאמתים את התשלום...';}
    setTimeout(function(){
      fetch('/api/mock-pay/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({outcome:o==='delay'?'success':o})})
        .then(function(r){return r.json();})
        .then(function(d){if(d.success)send(d.outcome,d.token);else{st.textContent=d.error||'שגיאה';send('failure');}})
        .catch(function(){st.textContent='שגיאה';send('failure');});
    },o==='delay'?4000:300);
  }
  f.querySelectorAll('[data-o]').forEach(function(b){b.onclick=function(){run(b.dataset.o);};});
})();
</script></body></html>`)
})

mockPay.post('/api/mock-pay/:id', async (c) => {
  if (getGateway(c.env)?.name !== 'mock') return c.notFound()
  const body = await c.req.json().catch(() => null)
  const outcome = isObject(body) && OUTCOMES.includes(body.outcome as (typeof OUTCOMES)[number]) ? (body.outcome as string) : ''
  if (!outcome) return c.json({ success: false, error: 'תוצאה לא תקינה' }, 400)
  const db = c.env.DB
  const order = await db.prepare('SELECT id, status, download_token FROM orders WHERE id = ?').bind(c.req.param('id')).first<{ id: number; status: string; download_token: string | null }>()
  if (!order || order.status !== 'pending') return c.json({ success: false, error: 'ההזמנה לא ממתינה לתשלום' }, 409)
  if (outcome === 'failure') {
    await db.prepare("UPDATE orders SET notes = notes || 'MOCK: תשלום נכשל\n', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id).run()
    return c.json({ success: true, outcome: 'failure' })
  }
  const token = order.download_token ?? randomToken(24)
  await db
    .prepare("UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP, download_token = ?, notes = notes || 'MOCK: תשלום בדיקה, לא חויב\n', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
    .bind(token, order.id)
    .run()
  return c.json({ success: true, outcome: 'success', token })
})
