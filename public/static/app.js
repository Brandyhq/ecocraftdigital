// ECOCRAFTDIGITAL - Digital Products Store

// Sample products data
const products = [
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
  },
  {
    id: 3,
    name: 'פלאגינים ל-WordPress',
    description: 'חבילת 10 פלאגינים מקצועיים לאתרי WordPress',
    price: 199,
    category: 'תוכנה',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop'
  },
  {
    id: 4,
    name: 'תבניות סושיאל מדיה',
    description: '50 תבניות עיצוב מוכנות לאינסטגרם ופייסבוק',
    price: 79,
    category: 'עיצוב',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop'
  },
  {
    id: 5,
    name: 'קורס וידאו - פיתוח אפליקציות',
    description: 'קורס מקיף בעברית לפיתוח אפליקציות מובייל, 30 שעות וידאו',
    price: 299,
    category: 'חינוך',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop'
  },
  {
    id: 6,
    name: 'מוזיקה ללא זכויות יוצרים',
    description: 'ספרייה של 100 רצועות מוזיקה לשימוש מסחרי',
    price: 249,
    category: 'מדיה',
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop'
  }
];

// Cart state
let cart = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  loadCart();
  renderProducts();
  setupEventListeners();
  updateCartBadge();
});

// Render products
function renderProducts() {
  const productsGrid = document.getElementById('products-grid');
  if (!productsGrid) return;
  
  productsGrid.innerHTML = products.map(product => `
    <div class="product-card bg-white rounded-lg shadow-md overflow-hidden">
      <img src="${product.image}" alt="${product.name}" class="w-full h-48 object-cover">
      <div class="p-4">
        <span class="category-badge">${product.category}</span>
        <h3 class="text-xl font-bold text-gray-800 mb-2">${product.name}</h3>
        <p class="text-gray-600 text-sm mb-4">${product.description}</p>
        <div class="flex justify-between items-center">
          <span class="price-tag">₪${product.price}</span>
          <button onclick="addToCart(${product.id})" class="btn-primary text-white px-4 py-2 rounded-lg hover:opacity-90">
            <i class="fas fa-cart-plus ml-2"></i>
            הוסף לעגלה
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Add to cart
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const existingItem = cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  
  saveCart();
  updateCartBadge();
  showNotification('המוצר נוסף לעגלה!');
}

// Remove from cart
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartBadge();
  renderCart();
}

// Update quantity
function updateQuantity(productId, change) {
  const item = cart.find(item => item.id === productId);
  if (!item) return;
  
  item.quantity += change;
  
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveCart();
    renderCart();
  }
}

// Calculate total
function calculateTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Update cart badge
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

// Render cart
function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  
  if (!cartItems || !cartTotal) return;
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="text-gray-600 text-center py-8">העגלה שלך ריקה</p>';
    cartTotal.textContent = '₪0';
    return;
  }
  
  cartItems.innerHTML = cart.map(item => `
    <div class="flex items-center justify-between border-b pb-4 mb-4">
      <div class="flex items-center gap-4">
        <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded">
        <div>
          <h4 class="font-bold text-gray-800">${item.name}</h4>
          <p class="text-gray-600 text-sm">₪${item.price}</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
          <button onclick="updateQuantity(${item.id}, -1)" class="text-gray-600 hover:text-gray-800">
            <i class="fas fa-minus"></i>
          </button>
          <span class="font-bold px-3">${item.quantity}</span>
          <button onclick="updateQuantity(${item.id}, 1)" class="text-gray-600 hover:text-gray-800">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
  
  const total = calculateTotal();
  cartTotal.textContent = `₪${total}`;
}

// Show cart modal
function showCart() {
  renderCart();
  const modal = document.getElementById('cart-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

// Close cart modal
function closeCart() {
  const modal = document.getElementById('cart-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Show checkout modal
function showCheckout() {
  if (cart.length === 0) {
    showNotification('העגלה שלך ריקה!');
    return;
  }
  
  closeCart();
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

// Close checkout modal
function closeCheckout() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Handle checkout
function handleCheckout(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const orderData = {
    customer: {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone')
    },
    items: cart,
    total: calculateTotal(),
    date: new Date().toISOString()
  };
  
  console.log('Order submitted:', orderData);
  
  // Here you would send the order to your backend
  // For now, we'll just show a success message
  
  showNotification('הזמנתך התקבלה בהצלחה! נשלח אליך מייל עם פרטי התשלום.');
  
  // Clear cart
  cart = [];
  saveCart();
  updateCartBadge();
  
  // Close modal
  closeCheckout();
  
  // Reset form
  event.target.reset();
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem('ecocraft_cart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCart() {
  const savedCart = localStorage.getItem('ecocraft_cart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
  }
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Setup event listeners
function setupEventListeners() {
  // Close modals when clicking outside
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      closeCart();
      closeCheckout();
    }
  });
  
  // Checkout form
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckout);
  }
}
