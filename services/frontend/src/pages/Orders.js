import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI } from '../api/api';
import { AuthContext } from '../context/AuthContext';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchOrders();
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await ordersAPI.getMyOrders();
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (orderId) => {
    try {
      setProcessingPayment(orderId);
      const response = await ordersAPI.processPayment(orderId, { payment_method: 'credit_card' });
      
      // Update the order in the list
      setOrders(orders.map(order => 
        order.id === orderId ? response.data : order
      ));
      
      setProcessingPayment(null);
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment');
      setProcessingPayment(null);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const response = await ordersAPI.updateOrderStatus(orderId, { status: newStatus });
      
      // Update the order in the list
      setOrders(orders.map(order => 
        order.id === orderId ? response.data : order
      ));
      
      setUpdatingOrderId(null);
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status: ' + (error.response?.data?.message || error.message));
      setUpdatingOrderId(null);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      awaiting_payment: '#f39c12',
      confirmed: '#27ae60',
      shipped: '#3498db',
      delivered: '#2ecc71',
      cancelled: '#e74c3c',
      returned: '#95a5a6'
    };
    return colors[status] || '#95a5a6';
  };

  const getStatusEmoji = (status) => {
    const emojis = {
      awaiting_payment: '⏳',
      confirmed: '✅',
      shipped: '📦',
      delivered: '🎉',
      cancelled: '❌',
      returned: '↩️'
    };
    return emojis[status] || '📋';
  };

  const getUserAllowedActions = (currentStatus) => {
    // Regular users can only cancel orders (except terminal states)
    const cancellableStates = ['awaiting_payment', 'confirmed', 'shipped'];
    return cancellableStates.includes(currentStatus) ? ['cancelled'] : [];
  };

  if (loading) {
    return <div className="loading">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>No orders yet</h2>
          <p>Start shopping to see your orders here</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Orders</h1>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className="order-card" style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}>
            <div className="order-header">
              <div>
                <h3>Order #{order.id}</h3>
                <p style={{ color: '#7f8c8d', marginTop: '0.5rem' }}>
                  Placed on {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{
                  backgroundColor: getStatusColor(order.status),
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>
                  {getStatusEmoji(order.status)} {order.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                Total: ${order.total_amount.toFixed(2)}
              </p>
              {order.items && order.items.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Items ({order.items.length}):</p>
                  {order.items.map((item, idx) => (
                    <p key={idx} style={{ color: '#7f8c8d', fontSize: '0.95rem' }}>
                      • Product #{item.product_id} - Qty: {item.quantity} @ ${item.price.toFixed(2)}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section */}
            {order.status === 'awaiting_payment' && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                borderLeft: '4px solid #f39c12'
              }}>
                <p style={{ marginBottom: '1rem', fontWeight: '600', color: '#856404' }}>
                  ⏳ Payment Required
                </p>
                <button
                  onClick={() => handlePayment(order.id)}
                  disabled={processingPayment === order.id}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: processingPayment === order.id ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: processingPayment === order.id ? 0.6 : 1
                  }}
                >
                  {processingPayment === order.id ? 'Processing...' : '💳 Pay Now'}
                </button>
              </div>
            )}

            {/* Order Actions - Users can only cancel */}
            {getUserAllowedActions(order.status).length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Actions:</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                    disabled={updatingOrderId === order.id}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: updatingOrderId === order.id ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      opacity: updatingOrderId === order.id ? 0.6 : 1,
                      fontSize: '0.9rem'
                    }}
                  >
                    {updatingOrderId === order.id ? 'Processing...' : '❌ Cancel Order'}
                  </button>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ecf0f1' }}>
              <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Timeline:</p>
              <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                <div>✓ Order Created</div>
                <div style={{ marginLeft: '1rem' }}>
                  {order.status !== 'awaiting_payment' ? '✓ Payment Confirmed' : '⏳ Awaiting Payment'}
                </div>
                {['confirmed', 'shipped', 'delivered'].includes(order.status) && (
                  <div style={{ marginLeft: '1rem' }}>✓ Order Confirmed</div>
                )}
                {['shipped', 'delivered'].includes(order.status) && (
                  <div style={{ marginLeft: '1rem' }}>✓ Shipped</div>
                )}
                {order.status === 'delivered' && (
                  <div style={{ marginLeft: '1rem' }}>✓ Delivered</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Orders;
