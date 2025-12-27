import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  MenuItem,
  Box,
  CircularProgress,
  Chip,
  Alert,
  Paper,
} from '@mui/material';
import {
  AddShoppingCart,
  Inventory2,
  Search,
} from '@mui/icons-material';
import { productsAPI } from '../api/api';
import { CartContext } from '../context/CartContext';

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, [category, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (category) params.category = category;
      if (search) params.search = search;
      
      const response = await productsAPI.getAll(params);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product, e) => {
    e.stopPropagation();
    addToCart(product, 1);
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
          Products
        </Typography>
        
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                variant="outlined"
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="Electronics">Electronics</MenuItem>
                <MenuItem value="Accessories">Accessories</MenuItem>
                <MenuItem value="Office">Office</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <TextField
                fullWidth
                label="Search products"
                placeholder="Search by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="outlined"
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {products.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Inventory2 sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom color="text.secondary">
            No products found
          </Typography>
          <Typography color="text.secondary">
            Try adjusting your filters
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {products.map((product) => (
            <Grid item key={product.id} xs={12} sm={6} md={4} lg={3}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                  },
                }}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={product.image_url}
                  alt={product.name}
                  sx={{ objectFit: 'cover', bgcolor: 'grey.100' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" gutterBottom noWrap>
                    {product.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {product.description}
                  </Typography>
                  <Typography variant="h5" color="success.main" fontWeight={700} gutterBottom>
                    ${product.price.toFixed(2)}
                  </Typography>
                  <Chip
                    label={product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    size="small"
                    color={product.stock === 0 ? 'error' : product.stock < 10 ? 'warning' : 'success'}
                    variant={product.stock === 0 ? 'filled' : 'outlined'}
                  />
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AddShoppingCart />}
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={product.stock === 0}
                    size="large"
                  >
                    Add to Cart
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default Home;
