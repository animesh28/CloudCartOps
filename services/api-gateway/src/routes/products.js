const express = require('express');
const axios = require('axios');

const router = express.Router();
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:8002';

// Get all products
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let url = `${PRODUCT_SERVICE_URL}/products`;
    
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Get product by ID
router.get('/:id', async (req, res, next) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/products/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Get products by category
router.get('/category/:category', async (req, res, next) => {
  try {
    const response = await axios.get(
      `${PRODUCT_SERVICE_URL}/products/category/${req.params.category}`
    );
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

module.exports = router;
