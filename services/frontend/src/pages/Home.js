import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
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
    alert('Added to cart!');
  };

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="container">
      <div className="products-header">
        <h1>Products</h1>
        <div className="filters">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Accessories">Accessories</option>
            <option value="Office">Office</option>
          </select>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <h2>No products found</h2>
          <p>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(product => (
            <div
              key={product.id}
              className="product-card"
              onClick={() => navigate(`/products/${product.id}`)}
            >
              <img
                src={product.image_url}
                alt={product.name}
                className="product-image"
              />
              <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-description">{product.description}</p>
                <p className="product-price">${product.price.toFixed(2)}</p>
                <p className={`product-stock ${product.stock < 10 ? 'low' : ''}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={(e) => handleAddToCart(product, e)}
                  disabled={product.stock === 0}
                  style={{ width: '100%' }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
