import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const api = new Hono<{ Bindings: Bindings }>()

// Get all products
api.get('/products', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC
    `).all()
    
    return c.json({ success: true, products: results })
  } catch (error) {
    console.error('Error fetching products:', error)
    return c.json({ success: false, error: 'Failed to fetch products' }, 500)
  }
})

// Get single product
api.get('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM products WHERE id = ? AND active = 1
    `).bind(id).all()
    
    if (!results || results.length === 0) {
      return c.json({ success: false, error: 'Product not found' }, 404)
    }
    
    return c.json({ success: true, product: results[0] })
  } catch (error) {
    console.error('Error fetching product:', error)
    return c.json({ success: false, error: 'Failed to fetch product' }, 500)
  }
})

// Create order
api.post('/orders', async (c) => {
  try {
    const { customer, items, total } = await c.req.json()
    
    // Validate input
    if (!customer || !customer.name || !customer.email || !items || items.length === 0) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }
    
    // Check if customer exists
    const { results: existingCustomers } = await c.env.DB.prepare(`
      SELECT * FROM customers WHERE email = ?
    `).bind(customer.email).all()
    
    let customerId
    
    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id
    } else {
      // Create new customer
      const customerResult = await c.env.DB.prepare(`
        INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)
      `).bind(customer.name, customer.email, customer.phone || null).run()
      
      customerId = customerResult.meta.last_row_id
    }
    
    // Create order
    const orderResult = await c.env.DB.prepare(`
      INSERT INTO orders (customer_id, total_amount, status, payment_status)
      VALUES (?, ?, 'pending', 'pending')
    `).bind(customerId, total).run()
    
    const orderId = orderResult.meta.last_row_id
    
    // Create order items
    for (const item of items) {
      await c.env.DB.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `).bind(orderId, item.id, item.quantity, item.price).run()
    }
    
    return c.json({
      success: true,
      order: {
        id: orderId,
        customer_id: customerId,
        total,
        status: 'pending'
      }
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return c.json({ success: false, error: 'Failed to create order' }, 500)
  }
})

// Get order by ID
api.get('/orders/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const { results: orders } = await c.env.DB.prepare(`
      SELECT o.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).bind(id).all()
    
    if (!orders || orders.length === 0) {
      return c.json({ success: false, error: 'Order not found' }, 404)
    }
    
    const order = orders[0]
    
    // Get order items
    const { results: items } = await c.env.DB.prepare(`
      SELECT oi.*, p.name as product_name, p.image as product_image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(id).all()
    
    return c.json({
      success: true,
      order: {
        ...order,
        items
      }
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    return c.json({ success: false, error: 'Failed to fetch order' }, 500)
  }
})

// ADMIN: Get all orders
api.get('/admin/orders', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT o.*, c.name as customer_name, c.email as customer_email
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
    `).all()
    
    return c.json({ success: true, orders: results })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return c.json({ success: false, error: 'Failed to fetch orders' }, 500)
  }
})

// ADMIN: Create product
api.post('/admin/products', async (c) => {
  try {
    const { name, description, price, category, image, digital_file_url } = await c.req.json()
    
    if (!name || !price || !category) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO products (name, description, price, category, image, digital_file_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(name, description || '', price, category, image || '', digital_file_url || '').run()
    
    return c.json({
      success: true,
      product: {
        id: result.meta.last_row_id,
        name,
        description,
        price,
        category,
        image,
        digital_file_url
      }
    })
  } catch (error) {
    console.error('Error creating product:', error)
    return c.json({ success: false, error: 'Failed to create product' }, 500)
  }
})

// ADMIN: Update product
api.put('/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { name, description, price, category, image, digital_file_url, active } = await c.req.json()
    
    await c.env.DB.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, category = ?, 
          image = ?, digital_file_url = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, description, price, category, image, digital_file_url, active, id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating product:', error)
    return c.json({ success: false, error: 'Failed to update product' }, 500)
  }
})

// ADMIN: Delete product (soft delete)
api.delete('/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    await c.env.DB.prepare(`
      UPDATE products SET active = 0 WHERE id = ?
    `).bind(id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return c.json({ success: false, error: 'Failed to delete product' }, 500)
  }
})

// ADMIN: Get all products (including inactive)
api.get('/admin/products', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM products ORDER BY created_at DESC
    `).all()
    
    return c.json({ success: true, products: results })
  } catch (error) {
    console.error('Error fetching products:', error)
    return c.json({ success: false, error: 'Failed to fetch products' }, 500)
  }
})

// ADMIN: Update order status
api.put('/admin/orders/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { status, payment_status } = await c.req.json()
    
    await c.env.DB.prepare(`
      UPDATE orders 
      SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, payment_status, id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating order:', error)
    return c.json({ success: false, error: 'Failed to update order' }, 500)
  }
})

export default api
