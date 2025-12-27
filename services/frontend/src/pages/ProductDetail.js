import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  Chip,
  CircularProgress,
  Breadcrumbs,
  Link,
  TextField
} from '@mui/material';
import {
  ArrowBack,
  Add,
  Remove,
  ShoppingCart,
  Home as HomeIcon,
} from '@mui/icons-material';
import { productsAPI } from '../api/api';
import { CartContext } from '../context/CartContext';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await productsAPI.getById(id);
      setProduct(response.data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    navigate('/cart');
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

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Product not found
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Products
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/')}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Products
        </Link>
        <Typography color="text.primary">{product.name}</Typography>
      </Breadcrumbs>

      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 3 }}
      >
        Back to Products
      </Button>

      <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src={product.image_url}
              alt={product.name}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: 500,
                objectFit: 'cover',
                borderRadius: 2,
                bgcolor: 'grey.100',
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
              {product.name}
            </Typography>

            <Typography variant="h4" color="success.main" fontWeight={700} gutterBottom>
              ${product.price.toFixed(2)}
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Chip
                label={product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                color={product.stock === 0 ? 'error' : product.stock < 10 ? 'warning' : 'success'}
                size="medium"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3 }}>
              {product.description}
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Category
              </Typography>
              <Chip label={product.category} color="primary" variant="outlined" />
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Quantity
              </Typography>
              <TextField
                type="number"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantity(Math.max(1, Math.min(product.stock, val)));
                }}
                inputProps={{ min: 1, max: product.stock }}
                size="medium"
                sx={{ width: 150 }}
                label="Enter quantity"
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              startIcon={<ShoppingCart />}
              sx={{ py: 2, fontSize: '1.1rem', fontWeight: 600 }}
            >
              {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}

export default ProductDetail;