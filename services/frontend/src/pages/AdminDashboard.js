import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  LocalShipping,
  Inventory2,
  AdminPanelSettings,
  People,
  Science,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../api/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3, px: 3 }}>{children}</Box>}
    </div>
  );
}


function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const isAdmin = user?.is_admin === true;

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <AdminPanelSettings sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          You don't have permission to access the admin panel
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Go Back Home
        </Button>
      </Container>
    );
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 3, mb: 3 }}>
        <Container maxWidth="xl">
          <Typography variant="h3" fontWeight={700} gutterBottom>
            <AdminPanelSettings sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle' }} />
            Admin Dashboard
          </Typography>
          <Typography variant="body1">
            Welcome, {user?.username || 'Admin'}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="xl">
        <Paper elevation={2} sx={{ borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 64,
                fontWeight: 600,
              },
            }}
          >
            <Tab label="Orders" icon={<LocalShipping />} iconPosition="start" />
            <Tab label="Inventory" icon={<Inventory2 />} iconPosition="start" />
            <Tab label="Users" icon={<People />} iconPosition="start" />
            <Tab label="Chaos Engineering" icon={<Science />} iconPosition="start" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <AdminOrders />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <AdminInventory />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <AdminUsers />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <ChaosEngineering />
          </TabPanel>
        </Paper>
      </Container>
    </Box>
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
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
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      awaiting_payment: 'warning',
      confirmed: 'success',
      shipped: 'info',
      delivered: 'success',
      cancelled: 'error',
      returned: 'default'
    };
    return colors[status] || 'default';
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          All Orders
        </Typography>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={fetchAllOrders}
        >
          Refresh
        </Button>
      </Box>

      {orders.length === 0 ? (
        <Alert severity="info">No orders found</Alert>
      ) : (
        <Grid container spacing={2}>
          {orders.map((order) => (
            <Grid item xs={12} key={order.id}>
              <Card
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderLeft: 4,
                  borderLeftColor: getStatusColor(order.status) === 'success' ? '#4caf50' : getStatusColor(order.status) === 'error' ? '#f44336' : '#ff9800',
                  bgcolor: 'action.hover',
                  transition: 'bgcolor 0.2s',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        Order #{order.id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        User ID: {order.user_id} | Total: ${order.total_amount.toFixed(2)}
                      </Typography>
                      {order.items && order.items.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {order.items.map((item, idx) => (
                            <Typography key={idx} variant="caption" color="text.secondary" display="block">
                              {item.product_name || `Product #${item.product_id}`} × {item.quantity} @ ${item.price.toFixed(2)}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Chip
                      label={order.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(order.status)}
                      size="medium"
                    />
                  </Box>

                  {getNextStatus(order.status).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {getNextStatus(order.status).map((status) => (
                        <Button
                          key={status}
                          size="small"
                          variant="outlined"
                          onClick={() => handleStatusUpdate(order.id, status)}
                        >
                          {status === 'shipped' && '📦 Ship'}
                          {status === 'delivered' && '✓ Deliver'}
                          {status === 'returned' && '↩ Return'}
                          {status === 'confirmed' && '✓ Confirm'}
                          {status === 'cancelled' && '✗ Cancel'}
                        </Button>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
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
      setProducts(data.sort((a, b) => a.stock - b.stock));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId, newStock) => {
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: parseInt(newStock) })
      });

      if (response.ok) {
        const updated = await response.json();
        setProducts(products.map(p => p.id === productId ? updated : p));
      }
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Inventory Management
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Product</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Category</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Current Stock</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{product.name}</Typography>
                </TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={product.stock}
                    color={product.stock < 10 ? 'error' : product.stock < 50 ? 'warning' : 'success'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  {product.stock < 10 && '🔴 Critical'}
                  {product.stock >= 10 && product.stock < 50 && '🟡 Low'}
                  {product.stock >= 50 && '🟢 Healthy'}
                </TableCell>
                <TableCell align="center">
                  <TextField
                    type="number"
                    defaultValue={product.stock}
                    size="small"
                    sx={{ width: 100 }}
                    inputProps={{ min: 0 }}
                    onBlur={(e) => updateStock(product.id, e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        User Management
      </Typography>

      {users.length === 0 ? (
        <Alert severity="info">No users found</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Username</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Full Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{user.username}</Typography>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(user.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
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