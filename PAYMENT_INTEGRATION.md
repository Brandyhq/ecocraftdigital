# מדריך אינטגרציה עם שערי תשלום

## סקירה
האתר מוכן לאינטגרציה עם שערי תשלום ישראליים ובינלאומיים. להלן הוראות להוספת כל שער תשלום.

## שערי תשלום נתמכים

### 1. Tranzila (טרנזילה) - מומלץ לישראל
**יתרונות**: שער תשלום ישראלי, תמיכה בשקלים, ממשק בעברית

**צעדים להתקנה:**

1. **הרשמה ל-Tranzila**
   - פנה ל-https://www.tranzila.com/ והירשם לחשבון
   - קבל את ה-Terminal Name וה-Terminal Password

2. **הוסף את הקוד לצד שרת** (`src/api.tsx`):
```typescript
// Payment endpoint
api.post('/payment/process', async (c) => {
  try {
    const { orderId, amount } = await c.req.json()
    
    // Tranzila API call
    const response = await fetch('https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        supplier: 'YOUR_TERMINAL_NAME',
        TranzilaPW: 'YOUR_TERMINAL_PASSWORD',
        sum: amount.toString(),
        currency: '1', // 1 = ILS
        cred_type: '1', // Regular payment
        tranmode: 'V' // Verify and charge
      })
    })
    
    const result = await response.text()
    
    // Parse Tranzila response
    if (result.includes('Response=000')) {
      // Payment successful
      await c.env.DB.prepare(`
        UPDATE orders SET payment_status = 'paid', status = 'completed' WHERE id = ?
      `).bind(orderId).run()
      
      return c.json({ success: true, message: 'Payment successful' })
    } else {
      return c.json({ success: false, error: 'Payment failed' }, 400)
    }
  } catch (error) {
    return c.json({ success: false, error: 'Payment processing error' }, 500)
  }
})
```

3. **הגדר משתני סביבה ב-wrangler.jsonc**:
```jsonc
{
  "vars": {
    "TRANZILA_TERMINAL": "your-terminal-name",
    "TRANZILA_PASSWORD": "your-password"
  }
}
```

### 2. PayPal - בינלאומי
**יתרונות**: נתמך בכל העולם, מהימן

**צעדים להתקנה:**

1. **הרשמה ל-PayPal Developer**
   - עבור ל-https://developer.paypal.com/
   - צור אפליקציה חדשה וקבל Client ID ו-Secret

2. **הוסף SDK ל-Frontend** (בתוך `<head>`):
```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=ILS"></script>
```

3. **הוסף כפתור PayPal** (ב-checkout modal):
```javascript
function initPayPal() {
  paypal.Buttons({
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: calculateTotal().toString()
          }
        }]
      });
    },
    onApprove: async function(data, actions) {
      const order = await actions.order.capture();
      // Send order to backend
      await fetch('/api/payment/paypal-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID })
      });
    }
  }).render('#paypal-button-container');
}
```

### 3. Stripe - בינלאומי
**יתרונות**: פשוט מאוד, תיעוד מצוין

**צעדים להתקנה:**

1. **הרשמה ל-Stripe**
   - עבור ל-https://stripe.com/ והירשם
   - קבל את ה-Publishable Key וה-Secret Key

2. **התקן Stripe SDK**:
```bash
npm install stripe
```

3. **הוסף endpoint לצד שרת**:
```typescript
import Stripe from 'stripe'

api.post('/payment/create-checkout-session', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY)
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: cart.map(item => ({
      price_data: {
        currency: 'ils',
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100, // In cents
      },
      quantity: item.quantity,
    })),
    mode: 'payment',
    success_url: 'https://yourdomain.com/success',
    cancel_url: 'https://yourdomain.com/cancel',
  })
  
  return c.json({ url: session.url })
})
```

## הוספת שער תשלום לאתר

### שינויים נדרשים ב-Frontend (app.js)

```javascript
// בתוך handleCheckout function:
async function handleCheckout(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const orderData = {
    customer: {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone')
    },
    items: cart,
    total: calculateTotal()
  };
  
  try {
    // שלב 1: צור הזמנה
    const orderResponse = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    const orderResult = await orderResponse.json();
    
    if (orderResult.success) {
      const orderId = orderResult.order.id;
      
      // שלב 2: הפנה לתשלום
      // עבור Tranzila:
      window.location.href = `/payment/tranzila?orderId=${orderId}`;
      
      // עבור PayPal: הצג כפתור PayPal
      // עבור Stripe: הפנה ל-checkout session
      const paymentResponse = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: orderData.total })
      });
      
      const { url } = await paymentResponse.json();
      window.location.href = url;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## משתני סביבה נדרשים

הוסף ל-`.dev.vars` (פיתוח מקומי):
```
TRANZILA_TERMINAL=your-terminal
TRANZILA_PASSWORD=your-password
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_SECRET=your-secret
STRIPE_SECRET_KEY=sk_test_...
```

לייצור, השתמש ב:
```bash
npx wrangler secret put TRANZILA_PASSWORD
npx wrangler secret put PAYPAL_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
```

## Webhooks לאישור תשלום

### דוגמה ל-Webhook של Stripe:
```typescript
api.post('/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()
  
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      c.env.STRIPE_WEBHOOK_SECRET
    )
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      
      // עדכן את סטטוס ההזמנה
      await c.env.DB.prepare(`
        UPDATE orders 
        SET payment_status = 'paid', status = 'completed'
        WHERE id = ?
      `).bind(session.metadata.orderId).run()
    }
    
    return c.json({ received: true })
  } catch (err) {
    return c.json({ error: 'Webhook error' }, 400)
  }
})
```

## המלצות

1. **התחל עם Stripe או PayPal** אם אתה מוכר גם לקהל בינלאומי
2. **השתמש ב-Tranzila** אם אתה מוכר רק לישראלים (תמיכה טובה יותר בשקלים)
3. **הוסף יותר משער תשלום אחד** כדי לתת ללקוחות אפשרויות
4. **בדוק תמיד בסביבת sandbox** לפני להעביר לייצור
5. **שמור לוגים של כל תשלום** לצורכי ביקורת

## תמיכה ומשאבים

- Tranzila: https://www.tranzila.com/docs/
- PayPal: https://developer.paypal.com/docs/
- Stripe: https://stripe.com/docs
