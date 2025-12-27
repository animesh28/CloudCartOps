-- Initialize Database Schema for CloudCart Ops

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert Sample Data
-- Sample Products
INSERT INTO products (name, description, price, stock, category, image_url) VALUES
    ('Laptop Pro 15', 'High-performance laptop for professionals', 1299.99, 50, 'Electronics', 'https://via.placeholder.com/300'),
    ('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 200, 'Accessories', 'https://via.placeholder.com/300'),
    ('USB-C Hub', '7-in-1 USB-C hub with HDMI and ethernet', 49.99, 150, 'Accessories', 'https://via.placeholder.com/300'),
    ('Mechanical Keyboard', 'RGB mechanical gaming keyboard', 89.99, 75, 'Accessories', 'https://via.placeholder.com/300'),
    ('Monitor 27"', '4K UHD 27-inch monitor', 399.99, 30, 'Electronics', 'https://via.placeholder.com/300'),
    ('Webcam HD', '1080p HD webcam with microphone', 69.99, 100, 'Electronics', 'https://via.placeholder.com/300'),
    ('Desk Lamp', 'LED desk lamp with adjustable brightness', 34.99, 120, 'Office', 'https://via.placeholder.com/300'),
    ('Notebook Set', 'Set of 3 premium notebooks', 19.99, 300, 'Office', 'https://via.placeholder.com/300'),
    ('Backpack', 'Laptop backpack with USB charging port', 59.99, 80, 'Accessories', 'https://via.placeholder.com/300'),
    ('Phone Stand', 'Adjustable phone and tablet stand', 14.99, 250, 'Accessories', 'https://via.placeholder.com/300')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
