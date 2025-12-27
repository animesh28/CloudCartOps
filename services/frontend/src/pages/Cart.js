import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { ordersAPI } from '../api/api';

function Cart() {
  const { cart, removeFromCart, updateQuantity, clearCart, getTotal } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!user) {
      alert('Please login to checkout');
      navigate('/login');
      return;
    }

    const items = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    try {
      const response = await ordersAPI.create({ items });
      alert('Order placed successfully!');
      clearCart();
      navigate('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>Your cart is empty</h2>
          <p>Add some products to get started</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="cart-container">
        <h1>Shopping Cart</h1>
        
        <div className="cart-items">
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              <img
                src={item.image_url}
                alt={item.name}
                className="cart-item-image"
              />
              <div className="cart-item-info">
                <h3>{item.name}</h3>
                <p>${item.price.toFixed(2)}</p>
              </div>
              <div className="quantity-selector">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                  min="1"
                />
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              <p style={{ fontWeight: 'bold' }}>
                ${(item.price * item.quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeFromCart(item.id)}
                className="btn btn-secondary"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <div className="cart-total">
            <span>Total:</span>
            <span>${getTotal().toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;
