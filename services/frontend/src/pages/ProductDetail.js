import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    alert('Added to cart!');
    navigate('/cart');
  };

  if (loading) {
    return <div className="loading">Loading product...</div>;
  }

  if (!product) {
    return <div className="empty-state"><h2>Product not found</h2></div>;
  }

  return (
    <div className="container">
      <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
        ← Back to Products
      </button>
      
      <div className="product-detail">
        <div className="product-detail-content">
          <img
            src={product.image_url}
            alt={product.name}
            className="product-detail-image"
          />
          <div className="product-detail-info">
            <h1>{product.name}</h1>
            <p className="product-price">${product.price.toFixed(2)}</p>
            <p className={`product-stock ${product.stock < 10 ? 'low' : ''}`}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </p>
            <p style={{ margin: '1rem 0', color: '#7f8c8d' }}>{product.description}</p>
            <p style={{ marginBottom: '1rem' }}>
              <strong>Category:</strong> {product.category}
            </p>
            
            <div className="quantity-selector">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max={product.stock}
              />
              <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</button>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
