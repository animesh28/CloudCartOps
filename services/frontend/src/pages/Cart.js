import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Divider,
  Paper,
  Grid,
  TextField,
} from '@mui/material';
import {
  Delete,
  Add,
  Remove,
  ShoppingCartCheckout,
  ShoppingBag,
} from '@mui/icons-material';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { ordersAPI } from '../api/api';

function Cart() {
  const { cart, removeFromCart, updateQuantity, clearCart, getTotal } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!user) {
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
      clearCart();
      navigate('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  if (cart.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <ShoppingBag sx={{ fontSize: 100, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Your cart is empty
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Add some products to get started
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
        Shopping Cart
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            {cart.map((item, index) => (
              <Box key={item.id}>
                <Card
                  elevation={0}
                  sx={{
                    display: 'flex',
                    mb: 2,
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                  }}
                >
                  <CardMedia
                    component="img"
                    sx={{ width: 120, height: 120, borderRadius: 2, objectFit: 'cover' }}
                    image={item.image_url}
                    alt={item.name}
                  />
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" component="h3" fontWeight={600}>
                        {item.name}
                      </Typography>
                      <IconButton
                        color="error"
                        onClick={() => removeFromCart(item.id)}
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    
                    <Typography variant="h6" color="success.main" fontWeight={700} sx={{ mb: 2 }}>
                      ${item.price.toFixed(2)}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          updateQuantity(item.id, Math.max(1, val));
                        }}
                        inputProps={{ min: 1 }}
                        size="small"
                        sx={{ width: 120 }}
                        label="Qty"
                      />
                      <Typography variant="h6" fontWeight={700}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
                {index < cart.length - 1 && <Divider sx={{ my: 1 }} />}
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'sticky', top: 80 }}>
            <Typography variant="h5" gutterBottom fontWeight={700}>
              Order Summary
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1">Items ({cart.length})</Typography>
                <Typography variant="body1">${getTotal().toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1">Shipping</Typography>
                <Typography variant="body1" color="success.main">FREE</Typography>
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight={700}>Total</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                ${getTotal().toFixed(2)}
              </Typography>
            </Box>
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleCheckout}
              startIcon={<ShoppingCartCheckout />}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              Proceed to Checkout
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Cart;