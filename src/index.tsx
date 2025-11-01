import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

// API route example
app.get('/api/products', (c) => {
  return c.json({
    products: [
      {
        id: 1,
        name: 'תבנית עיצוב לוגו מקצועי',
        description: 'קובץ AI/PSD לעיצוב לוגו מקצועי עם 20 וריאציות שונות',
        price: 149,
        category: 'עיצוב',
        image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=300&fit=crop'
      },
      {
        id: 2,
        name: 'ספר אלקטרוני - מדריך שיווק דיגיטלי',
        description: 'מדריך מקיף לשיווק דיגיטלי בעברית, 150 עמודים PDF',
        price: 99,
        category: 'חינוך',
        image: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=300&fit=crop'
      }
    ]
  })
})

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ECOCRAFTDIGITAL - מוצרים דיגיטליים</title>
        <meta name="description" content="חנות מוצרים דיגיטליים איכוטיים - תבניות, קורסים, ספרים דיגיטליים ועוד">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-md sticky top-0 z-50">
            <nav class="container mx-auto px-4 py-4 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <i class="fas fa-leaf text-green-600 text-2xl"></i>
                    <h1 class="text-2xl font-bold text-gray-800">ECOCRAFTDIGITAL</h1>
                </div>
                <div class="flex items-center gap-6">
                    <a href="#products" class="text-gray-600 hover:text-green-600">מוצרים</a>
                    <a href="#about" class="text-gray-600 hover:text-green-600">אודות</a>
                    <button onclick="showCart()" class="relative text-gray-600 hover:text-green-600">
                        <i class="fas fa-shopping-cart text-2xl"></i>
                        <span id="cart-badge" class="cart-badge" style="display: none;">0</span>
                    </button>
                </div>
            </nav>
        </header>

        <!-- Hero Section -->
        <section class="hero-section">
            <div class="container mx-auto px-4">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">מוצרים דיגיטליים איכותיים</h2>
                <p class="text-xl md:text-2xl mb-8 opacity-90">תבניות עיצוב, קורסים, ספרים דיגיטליים ועוד - הכל במקום אחד</p>
                <a href="#products" class="inline-block bg-white text-green-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition">
                    גלה את המוצרים שלנו
                    <i class="fas fa-arrow-down mr-2"></i>
                </a>
            </div>
        </section>

        <!-- Features -->
        <section class="py-16 bg-white">
            <div class="container mx-auto px-4">
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="text-center">
                        <div class="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-download text-green-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">הורדה מיידית</h3>
                        <p class="text-gray-600">קבל גישה מיידית למוצרים שלך לאחר הרכישה</p>
                    </div>
                    <div class="text-center">
                        <div class="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-shield-alt text-green-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">תשלום מאובטח</h3>
                        <p class="text-gray-600">כל העסקאות מוגנות ומאובטחות לחלוטין</p>
                    </div>
                    <div class="text-center">
                        <div class="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-headset text-green-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold mb-2">תמיכה 24/7</h3>
                        <p class="text-gray-600">צוות התמיכה שלנו זמין לעזרה בכל שאלה</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Products Section -->
        <section id="products" class="py-16 bg-gray-50">
            <div class="container mx-auto px-4">
                <h2 class="text-3xl font-bold text-center mb-12">המוצרים שלנו</h2>
                <div id="products-grid" class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <!-- Products will be rendered here by JavaScript -->
                </div>
            </div>
        </section>

        <!-- About Section -->
        <section id="about" class="py-16 bg-white">
            <div class="container mx-auto px-4 max-w-3xl text-center">
                <h2 class="text-3xl font-bold mb-6">אודות ECOCRAFTDIGITAL</h2>
                <p class="text-lg text-gray-600 mb-4">
                    אנחנו מתמחים במכירת מוצרים דיגיטליים איכותיים לקהל הישראלי. 
                    המטרה שלנו היא לספק לך כלים ומשאבים שיעזרו לך להצליח בעולם הדיגיטלי.
                </p>
                <p class="text-lg text-gray-600">
                    כל המוצרים שלנו נבחרו בקפידה ונבדקו על ידי מומחים, 
                    כדי להבטיח שתקבל את האיכות הטובה ביותר.
                </p>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-8">
            <div class="container mx-auto px-4 text-center">
                <div class="flex items-center justify-center gap-2 mb-4">
                    <i class="fas fa-leaf text-green-500 text-xl"></i>
                    <p class="text-xl font-bold">ECOCRAFTDIGITAL</p>
                </div>
                <p class="text-gray-400 mb-4">מוצרים דיגיטליים איכותיים לקהל הישראלי</p>
                <div class="flex justify-center gap-6 mb-4">
                    <a href="#" class="text-gray-400 hover:text-white"><i class="fab fa-facebook text-xl"></i></a>
                    <a href="#" class="text-gray-400 hover:text-white"><i class="fab fa-instagram text-xl"></i></a>
                    <a href="#" class="text-gray-400 hover:text-white"><i class="fab fa-twitter text-xl"></i></a>
                </div>
                <p class="text-gray-500 text-sm">&copy; 2025 ECOCRAFTDIGITAL. כל הזכויות שמורות.</p>
            </div>
        </footer>

        <!-- Cart Modal -->
        <div id="cart-modal" class="modal">
            <div class="modal-content">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">העגלה שלי</h2>
                    <button onclick="closeCart()" class="text-gray-500 hover:text-gray-700 text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="cart-items" class="mb-6">
                    <!-- Cart items will be rendered here -->
                </div>
                <div class="border-t pt-4 mb-6">
                    <div class="flex justify-between items-center text-xl font-bold">
                        <span>סה"כ:</span>
                        <span id="cart-total">₪0</span>
                    </div>
                </div>
                <button onclick="showCheckout()" class="w-full btn-primary text-white py-3 rounded-lg font-bold text-lg">
                    המשך לתשלום
                    <i class="fas fa-arrow-left mr-2"></i>
                </button>
            </div>
        </div>

        <!-- Checkout Modal -->
        <div id="checkout-modal" class="modal">
            <div class="modal-content">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">פרטי תשלום</h2>
                    <button onclick="closeCheckout()" class="text-gray-500 hover:text-gray-700 text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="checkout-form" class="space-y-4">
                    <div>
                        <label class="block text-gray-700 font-bold mb-2">שם מלא *</label>
                        <input type="text" name="name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-2">אימייל *</label>
                        <input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-2">טלפון *</label>
                        <input type="tel" name="phone" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500">
                    </div>
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-sm text-gray-700">
                            <i class="fas fa-info-circle text-yellow-500 ml-2"></i>
                            לאחר השלמת הטופס, תקבל מייל עם הוראות תשלום ולינק להורדת המוצרים.
                        </p>
                    </div>
                    <button type="submit" class="w-full btn-primary text-white py-3 rounded-lg font-bold text-lg">
                        שלח הזמנה
                        <i class="fas fa-paper-plane mr-2"></i>
                    </button>
                </form>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
