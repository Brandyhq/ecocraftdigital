// Admin Panel JavaScript

let products = [];
let orders = [];
let currentView = 'products';

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
  setupNavigation();
  loadProducts();
  loadOrders();
  showView('products');
});

// Setup navigation
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const view = this.dataset.view;
      showView(view);
    });
  });
}

// Show view
function showView(view) {
  currentView = view;
  
  // Update active nav button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-green-600', 'text-white');
    btn.classList.add('text-gray-600', 'hover:bg-gray-100');
  });
  
  const activeBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
    activeBtn.classList.add('bg-green-600', 'text-white');
  }
  
  // Hide all views
  document.querySelectorAll('.view-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show selected view
  const viewSection = document.getElementById(view + '-view');
  if (viewSection) {
    viewSection.style.display = 'block';
  }
}

// Load products
async function loadProducts() {
  try {
    const response = await fetch('/api/admin/products');
    const data = await response.json();
    
    if (data.success) {
      products = data.products;
      renderProducts();
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showNotification('שגיאה בטעינת מוצרים', 'error');
  }
}

// Render products
function renderProducts() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">אין מוצרים</td></tr>';
    return;
  }
  
  tbody.innerHTML = products.map(product => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4">${product.id}</td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <img src="${product.image || '/static/placeholder.png'}" alt="${product.name}" class="w-12 h-12 object-cover rounded">
          <span>${product.name}</span>
        </div>
      </td>
      <td class="py-3 px-4">${product.category}</td>
      <td class="py-3 px-4 font-bold">₪${product.price}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-1 rounded text-sm ${product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${product.active ? 'פעיל' : 'לא פעיל'}
        </span>
      </td>
      <td class="py-3 px-4">
        <button onclick="editProduct(${product.id})" class="text-blue-600 hover:text-blue-800 ml-3">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-800">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Show add product modal
function showAddProduct() {
  document.getElementById('product-modal-title').textContent = 'הוסף מוצר חדש';
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-modal').classList.add('active');
}

// Edit product
function editProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  
  document.getElementById('product-modal-title').textContent = 'ערוך מוצר';
  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-price').value = product.price;
  document.getElementById('product-category').value = product.category;
  document.getElementById('product-image').value = product.image || '';
  document.getElementById('product-file-url').value = product.digital_file_url || '';
  document.getElementById('product-active').checked = product.active === 1;
  
  document.getElementById('product-modal').classList.add('active');
}

// Delete product
async function deleteProduct(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;
  
  try {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('המוצר נמחק בהצלחה');
      loadProducts();
    } else {
      showNotification('שגיאה במחיקת המוצר', 'error');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    showNotification('שגיאה במחיקת המוצר', 'error');
  }
}

// Close product modal
function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

// Handle product form submit
async function handleProductSubmit(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const productId = document.getElementById('product-id').value;
  
  const productData = {
    name: formData.get('name'),
    description: formData.get('description'),
    price: parseFloat(formData.get('price')),
    category: formData.get('category'),
    image: formData.get('image'),
    digital_file_url: formData.get('file_url'),
    active: formData.get('active') === 'on' ? 1 : 0
  };
  
  try {
    const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
    const method = productId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(productId ? 'המוצר עודכן בהצלחה' : 'המוצר נוסף בהצלחה');
      closeProductModal();
      loadProducts();
    } else {
      showNotification('שגיאה בשמירת המוצר', 'error');
    }
  } catch (error) {
    console.error('Error saving product:', error);
    showNotification('שגיאה בשמירת המוצר', 'error');
  }
}

// Load orders
async function loadOrders() {
  try {
    const response = await fetch('/api/admin/orders');
    const data = await response.json();
    
    if (data.success) {
      orders = data.orders;
      renderOrders();
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    showNotification('שגיאה בטעינת הזמנות', 'error');
  }
}

// Render orders
function renderOrders() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;
  
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">אין הזמנות</td></tr>';
    return;
  }
  
  tbody.innerHTML = orders.map(order => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4">${order.id}</td>
      <td class="py-3 px-4">${order.customer_name}</td>
      <td class="py-3 px-4">${order.customer_email}</td>
      <td class="py-3 px-4 font-bold">₪${order.total_amount}</td>
      <td class="py-3 px-4">
        <select onchange="updateOrderStatus(${order.id}, this.value, '${order.payment_status}')" 
                class="border rounded px-2 py-1 text-sm">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>ממתין</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>הושלם</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>בוטל</option>
        </select>
      </td>
      <td class="py-3 px-4">
        <select onchange="updateOrderStatus(${order.id}, '${order.status}', this.value)" 
                class="border rounded px-2 py-1 text-sm">
          <option value="pending" ${order.payment_status === 'pending' ? 'selected' : ''}>ממתין</option>
          <option value="paid" ${order.payment_status === 'paid' ? 'selected' : ''}>שולם</option>
          <option value="failed" ${order.payment_status === 'failed' ? 'selected' : ''}>נכשל</option>
        </select>
      </td>
    </tr>
  `).join('');
}

// Update order status
async function updateOrderStatus(orderId, status, paymentStatus) {
  try {
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, payment_status: paymentStatus })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('הסטטוס עודכן בהצלחה');
      loadOrders();
    } else {
      showNotification('שגיאה בעדכון הסטטוס', 'error');
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    showNotification('שגיאה בעדכון הסטטוס', 'error');
  }
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
