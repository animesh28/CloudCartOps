import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import {
  Payment,
  Cancel,
  ShoppingBag,
  LocalShipping,
  CheckCircle,
  Schedule,
  Undo,
} from '@mui/icons-material';
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
      
      setOrders(orders.map(order => 
        order.id === orderId ? response.data : order
      ));
      
      setProcessingPayment(null);
    } catch (error) {
      console.error('Error processing payment:', error);
      setProcessingPayment(null);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const response = await ordersAPI.updateOrderStatus(orderId, { status: newStatus });
      
      setOrders(orders.map(order => 
        order.id === orderId ? response.data : order
      ));
      
      setUpdatingOrderId(null);
    } catch (error) {
      console.error('Error updating order status:', error);
      setUpdatingOrderId(null);
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

  const getStatusIcon = (status) => {
    const icons = {
      awaiting_payment: <Schedule />,
      confirmed: <CheckCircle />,
      shipped: <LocalShipping />,
      delivered: <CheckCircle />,
      cancelled: <Cancel />,
      returned: <Undo />
    };
    return icons[status] || <ShoppingBag />;
  };

  const getOrderSteps = (status) => {
    const steps = ['Order Placed', 'Payment', 'Confirmed', 'Shipped', 'Delivered'];
    let activeStep = 0;
    
    if (status === 'awaiting_payment') activeStep = 0;
    else if (status === 'confirmed') activeStep = 2;
    else if (status === 'shipped') activeStep = 3;
    else if (status === 'delivered') activeStep = 4;
    else if (status === 'cancelled' || status === 'returned') activeStep = -1;
    
    return { steps, activeStep };
  };

  const getUserAllowedActions = (currentStatus) => {
    const cancellableStates = ['awaiting_payment', 'confirmed', 'shipped'];
    return cancellableStates.includes(currentStatus) ? ['cancelled'] : [];
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (orders.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <ShoppingBag sx={{ fontSize: 100, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          No orders yet
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Start shopping to see your orders here
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/')}
          startIcon={<ShoppingBag />}
        >
          Browse Products
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
        My Orders
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {orders.map(order => {
          const { steps, activeStep } = getOrderSteps(order.status);
          
          return (
            <Paper key={order.id} elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Order #{order.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placed on {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                </Box>
                <Chip
                  icon={getStatusIcon(order.status)}
                  label={order.status.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(order.status)}
                  size="medium"
                  sx={{ fontWeight: 600, px: 1 }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h4" fontWeight={700} color="primary.main">
                    ${order.total_amount.toFixed(2)}
                  </Typography>
                </Grid>
                {order.items && order.items.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Items ({order.items.length})
                    </Typography>
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                      {order.items.map((item, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          • {item.product_name || `Product #${item.product_id}`} × {item.quantity} @ ${item.price.toFixed(2)}
                        </Typography>
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>

              {/* Order Timeline */}
              {activeStep >= 0 && (
                <Box sx={{ mb: 3 }}>
                  <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              )}

              {/* Payment Section */}
              {order.status === 'awaiting_payment' && (
                <Alert
                  severity="warning"
                  icon={<Payment />}
                  sx={{ mb: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      variant="outlined"
                      onClick={() => handlePayment(order.id)}
                      disabled={processingPayment === order.id}
                      startIcon={<Payment />}
                      sx={{ fontWeight: 600 }}
                    >
                      {processingPayment === order.id ? 'Processing...' : 'Pay Now'}
                    </Button>
                  }
                >
                  <Typography fontWeight={600}>Payment Required</Typography>
                  Complete payment to confirm your order
                </Alert>
              )}

              {/* Order Actions */}
              {getUserAllowedActions(order.status).length > 0 && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                    disabled={updatingOrderId === order.id}
                    startIcon={<Cancel />}
                  >
                    {updatingOrderId === order.id ? 'Processing...' : 'Cancel Order'}
                  </Button>
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>
    </Container>
  );
}

export default Orders;