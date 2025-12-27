const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:8003';

// Get all orders (admin only)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders`);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Create order (protected)
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const orderData = {
      ...req.body,
      user_id: req.user.user_id
    };

    const response = await axios.post(`${ORDER_SERVICE_URL}/orders`, orderData);
    res.status(201).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Get user's orders
router.get('/my-orders', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.get(
      `${ORDER_SERVICE_URL}/orders/user/${req.user.user_id}`
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

// Get order by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders/${req.params.id}`);
    
    // Ensure user can only access their own orders
    if (response.data.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.patch(
      `${ORDER_SERVICE_URL}/orders/${req.params.id}/status`,
      req.body
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

// Process payment for order
router.post('/:id/pay', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.post(
      `${ORDER_SERVICE_URL}/orders/${req.params.id}/pay`,
      req.body
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
