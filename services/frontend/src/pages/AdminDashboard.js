import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../api/api';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('orders');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Check if user is admin (from backend is_admin field)
  const isAdmin = user?.is_admin === true;

  if (!isAdmin) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access the admin panel</p>
        <button 
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Admin Header */}
      <div style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="container">
          <h1 style={{ margin: '0 0 0.5rem 0' }}>🔧 Admin Dashboard</h1>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Welcome, {user?.username || 'Admin'}</p>
        </div>
      </div>

      <div className="container">
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '2px solid #ecf0f1',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'orders' ? '#3498db' : 'transparent',
              color: activeTab === 'orders' ? 'white' : '#2c3e50',
              border: 'none',
              borderBottom: activeTab === 'orders' ? '3px solid #3498db' : 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            📦 Orders
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'inventory' ? '#3498db' : 'transparent',
              color: activeTab === 'inventory' ? 'white' : '#2c3e50',
              border: 'none',
              borderBottom: activeTab === 'inventory' ? '3px solid #3498db' : 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            📊 Inventory
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'users' ? '#3498db' : 'transparent',
              color: activeTab === 'users' ? 'white' : '#2c3e50',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #3498db' : 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            👥 Users
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'chaos' ? '#e74c3c' : 'transparent',
              color: activeTab === 'chaos' ? 'white' : '#2c3e50',
              border: 'none',
              borderBottom: activeTab === 'chaos' ? '3px solid #e74c3c' : 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            ⚡ Chaos Engineering
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'orders' && <AdminOrders />}
        {activeTab === 'inventory' && <AdminInventory />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'chaos' && <ChaosEngineering />}
      </div>
    </div>
  );
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchAllOrders();
  }, []);

  const fetchAllOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      alert('Failed to load orders. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updated = await response.json();
        setOrders(orders.map(o => o.id === orderId ? updated : o));
        
        // Show success message based on status change
        const statusMessages = {
          'shipped': 'Order marked as shipped - customer notified',
          'delivered': 'Order marked as delivered - customer notified',
          'returned': 'Order marked as returned',
          'confirmed': 'Order confirmed',
          'cancelled': 'Order cancelled'
        };
        
        alert(statusMessages[newStatus] || 'Order status updated successfully');
      } else {
        const error = await response.json();
        alert('Failed to update order: ' + (error.error || error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status');
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

  const getNextStatus = (currentStatus) => {
    const transitions = {
      awaiting_payment: ['confirmed', 'cancelled'],
      confirmed: ['shipped', 'cancelled'],
      shipped: ['delivered', 'returned'],
      delivered: ['returned'],
      cancelled: [],
      returned: []
    };
    return transitions[currentStatus] || [];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>All Orders</h2>
        <button 
          onClick={fetchAllOrders}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders found. Make sure the backend is running.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {orders.map(order => (
            <div key={order.id} style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderLeft: `4px solid ${getStatusColor(order.status)}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>Order #{order.id}</h3>
                  <p style={{ color: '#7f8c8d', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
                    User ID: {order.user_id} | Total: ${order.total_amount.toFixed(2)}
                  </p>
                  <p style={{ color: '#7f8c8d', fontSize: '0.85rem', margin: 0 }}>
                    Items: {order.items?.length || 0}
                  </p>
                </div>
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

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ecf0f1' }}>
                <p style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Update Status:</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {getNextStatus(order.status).map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(order.id, status)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.85rem'
                      }}
                    >
                      {status === 'shipped' && '📦 Shipped'}
                      {status === 'delivered' && '🎉 Delivered'}
                      {status === 'returned' && '↩️ Returned'}
                      {status === 'confirmed' && '✅ Confirm'}
                      {status === 'cancelled' && '❌ Cancel'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/products`);
      const data = await response.json();
      // Sort by stock level
      setProducts(data.sort((a, b) => a.stock - b.stock));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const updateStock = async (productId, newStock) => {
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stock: parseInt(newStock) })
      });

      if (response.ok) {
        const updated = await response.json();
        setProducts(products.map(p => p.id === productId ? updated : p));
        alert('Stock updated successfully');
      }
    } catch (error) {
      alert('Failed to update stock');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Inventory Management</h2>
      
      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead style={{ backgroundColor: '#34495e', color: 'white' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Product</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Current Stock</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => (
                <tr key={product.id} style={{
                  borderBottom: '1px solid #ecf0f1',
                  backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white'
                }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{product.name}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>{product.category}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{
                      backgroundColor: product.stock < 10 ? '#e74c3c' : product.stock < 50 ? '#f39c12' : '#27ae60',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}>
                      {product.stock}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
                    {product.stock < 10 && '🔴 Critical'}
                    {product.stock >= 10 && product.stock < 50 && '🟡 Low'}
                    {product.stock >= 50 && '🟢 Healthy'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      defaultValue={product.stock}
                      min="0"
                      style={{
                        width: '70px',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #bdc3c7',
                        marginRight: '0.5rem'
                      }}
                      onBlur={(e) => updateStock(product.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>User Management</h2>

      {loading ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead style={{ backgroundColor: '#34495e', color: 'white' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Username</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Full Name</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.id} style={{
                  borderBottom: '1px solid #ecf0f1',
                  backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white'
                }}>
                  <td style={{ padding: '1rem' }}>{user.id}</td>
                  <td style={{ padding: '1rem' }}><strong>{user.username}</strong></td>
                  <td style={{ padding: '1rem' }}>{user.email}</td>
                  <td style={{ padding: '1rem' }}>{user.full_name}</td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#7f8c8d' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Chaos Engineering Component
function ChaosEngineering() {
  const [latencyMin, setLatencyMin] = React.useState('500');
  const [latencyMax, setLatencyMax] = React.useState('2000');
  const [errorCode, setErrorCode] = React.useState('500');
  const [status, setStatus] = React.useState('');
  const [chaosConfig, setChaosConfig] = React.useState({
    enabled: false,
    config: { error_rate: 0, latency_min_ms: 0, latency_max_ms: 0, timeout_rate: 0 }
  });

  const fetchChaosStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/config`);
      const data = await response.json();
      setChaosConfig(data);
    } catch (error) {
      console.error('Error fetching chaos status:', error);
    }
  };

  // Inject Latency - POST /chaos/inject/latency (Affects Kafka lag)
  const injectLatency = async () => {
    if (!latencyMin || !latencyMax || isNaN(latencyMin) || isNaN(latencyMax)) {
      setStatus('❌ Please enter valid delay values');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/chaos/inject/latency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          min_ms: parseInt(latencyMin), 
          max_ms: parseInt(latencyMax) 
        })
      });
      const data = await response.json();
      setStatus(`✅ ${data.message} (Kafka lag will increase 📡)`);
    } catch (error) {
      setStatus('❌ Error injecting latency: ' + error.message);
    }
  };

  // Inject Error - POST /chaos/inject/error (Affects Kafka events)
  const injectError = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/inject/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error_code: parseInt(errorCode), 
          message: `Chaos HTTP ${errorCode}` 
        })
      });
      if (!response.ok) {
        setStatus(`✅ Error HTTP ${errorCode} injected (Kafka event: chaos.injected published 📡)`);
      }
    } catch (error) {
      setStatus(`✅ Error HTTP ${errorCode} injected (Kafka event: chaos.injected published 📡)`);
    }
  };

  // Inject Random Chaos - POST /chaos/inject/random (Affects Kafka randomly)
  const injectRandomChaos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/inject/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setStatus(`✅ ${data.message} (Random chaos published to Kafka 📡)`);
    } catch (error) {
      setStatus(`✅ Random chaos injected (Kafka event published 📡)`);
    }
  };

  // Test Slow Endpoint - GET /chaos/test/slow (Connection timeout testing)
  const testSlowEndpoint = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/test/slow`);
      const data = await response.json();
      setStatus(`✅ ${data.message} (${data.delay_ms}ms delay - test client timeout handling)`);
    } catch (error) {
      setStatus('✅ Slow endpoint tested (simulates network delays)');
    }
  };

  // Test Error Endpoint - GET /chaos/test/error (Error handling testing)
  const testErrorEndpoint = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/test/error`);
    } catch (error) {
      setStatus('✅ Error endpoint tested (500 error published to Kafka 📡)');
    }
  };

  // Test Memory Leak - GET /chaos/test/memory-leak (Resource limit testing)
  const testMemoryLeak = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chaos/test/memory-leak`);
      const data = await response.json();
      setStatus(`✅ ${data.message} (test Kubernetes memory limits)`);
    } catch (error) {
      setStatus('✅ Memory leak test triggered (pod should be OOMKilled by K8s)');
    }
  };

  // Enable/Disable Chaos
  const toggleChaos = async (enable) => {
    try {
      const endpoint = enable ? '/api/chaos/enable' : '/api/chaos/disable';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setStatus(enable ? '✅ Chaos service ENABLED' : '✅ Chaos service DISABLED');
      await fetchChaosStatus();
    } catch (error) {
      setStatus(`❌ Error toggling chaos: ${error.message}`);
    }
  };

  React.useEffect(() => {
    fetchChaosStatus();
    const interval = setInterval(fetchChaosStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const cardStyle = {
    backgroundColor: 'white',
    borderLeft: '4px solid #e74c3c',
    padding: '1.5rem',
    borderRadius: '6px',
    marginBottom: '1rem'
  };

  return (
    <div>
      <h3 style={{ color: '#e74c3c', marginBottom: '1rem' }}>⚡ Chaos Engineering Controls</h3>
      <p style={{ color: '#7f8c8d', marginBottom: '1.5rem' }}>
        Inject failures, delays, and errors to test system resilience. Each action publishes Kafka events for observability.
      </p>

      {/* Current Status */}
      <div style={{
        backgroundColor: chaosConfig.enabled ? '#ffe6e6' : '#e8f8f5',
        border: `2px solid ${chaosConfig.enabled ? '#e74c3c' : '#27ae60'}`,
        padding: '1rem',
        borderRadius: '6px',
        marginBottom: '1.5rem'
      }}>
        <strong>Service Status:</strong>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          <div>Chaos Service: {chaosConfig.enabled ? '🔴 ENABLED' : '🟢 DISABLED'}</div>
          <div>Error Rate: {chaosConfig.config?.error_rate * 100 || 0}%</div>
          <div>Latency Range: {chaosConfig.config?.latency_min_ms || 0}-{chaosConfig.config?.latency_max_ms || 0}ms</div>
        </div>
      </div>

      {/* Enable/Disable */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => toggleChaos(!chaosConfig.enabled)}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: chaosConfig.enabled ? '#27ae60' : '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem'
          }}
        >
          {chaosConfig.enabled ? '✅ Disable Chaos Service' : '❌ Enable Chaos Service'}
        </button>
      </div>

      {/* 1. Latency Injection (Affects Kafka Lag) */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#f39c12' }}>📍 Latency Injection</h4>
        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '0.75rem' }}>
          POST /chaos/inject/latency | Affects: Kafka lag, Consumer processing time
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            type="number"
            value={latencyMin}
            onChange={(e) => setLatencyMin(e.target.value)}
            placeholder="Min ms"
            min="0"
            max="5000"
            style={{
              padding: '0.5rem',
              border: '1px solid #bdc3c7',
              borderRadius: '4px'
            }}
          />
          <input
            type="number"
            value={latencyMax}
            onChange={(e) => setLatencyMax(e.target.value)}
            placeholder="Max ms"
            min="0"
            max="5000"
            style={{
              padding: '0.5rem',
              border: '1px solid #bdc3c7',
              borderRadius: '4px'
            }}
          />
        </div>
        <button
          onClick={injectLatency}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#f39c12',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📡 Inject Latency
        </button>
      </div>

      {/* 2. Error Injection (Affects Kafka Events) */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#e74c3c' }}>⚠️ Error Injection</h4>
        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '0.75rem' }}>
          POST /chaos/inject/error | Affects: Kafka event stream, Error tracking
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <select
            value={errorCode}
            onChange={(e) => setErrorCode(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #bdc3c7',
              borderRadius: '4px'
            }}
          >
            <option value="400">400 - Bad Request</option>
            <option value="500">500 - Internal Server Error</option>
            <option value="502">502 - Bad Gateway</option>
            <option value="503">503 - Service Unavailable</option>
            <option value="504">504 - Gateway Timeout</option>
          </select>
        </div>
        <button
          onClick={injectError}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📡 Inject HTTP Error
        </button>
      </div>

      {/* 3. Random Chaos (Affects Kafka Randomly) */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#9b59b6' }}>🎲 Random Chaos</h4>
        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '0.75rem' }}>
          POST /chaos/inject/random | Affects: Random latency or errors, Kafka events
        </p>
        <button
          onClick={injectRandomChaos}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📡 Trigger Random Chaos
        </button>
      </div>

      {/* 4. Test Endpoints Section */}
      <div style={{ ...cardStyle, borderLeftColor: '#3498db' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#3498db' }}>🧪 Test Endpoints (for client testing)</h4>
        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '0.75rem' }}>
          GET endpoints to test client resilience and timeout handling
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <button
            onClick={testSlowEndpoint}
            style={{
              padding: '0.5rem',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
            title="GET /chaos/test/slow - Tests timeout handling"
          >
            🐢 Slow (2-5s)
          </button>
          <button
            onClick={testErrorEndpoint}
            style={{
              padding: '0.5rem',
              backgroundColor: '#e67e22',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
            title="GET /chaos/test/error - Tests error handling"
          >
            💥 Error (500)
          </button>
          <button
            onClick={testMemoryLeak}
            style={{
              padding: '0.5rem',
              backgroundColor: '#c0392b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
            title="GET /chaos/test/memory-leak - Tests K8s memory limits"
          >
            💾 Memory OOM
          </button>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: status.includes('❌') ? '#ffe6e6' : '#e8f8f5',
          border: `2px solid ${status.includes('❌') ? '#e74c3c' : '#27ae60'}`,
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: status.includes('❌') ? '#c0392b' : '#229954'
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
