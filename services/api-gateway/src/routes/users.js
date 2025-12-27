const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:8001';

// Get all users (protected)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/users`);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/users/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Update user
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    // Only allow users to update their own profile
    if (req.user.user_id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const response = await axios.put(
      `${USER_SERVICE_URL}/users/${req.params.id}`,
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

// Delete user
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    // Only allow users to delete their own profile
    if (req.user.user_id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const response = await axios.delete(`${USER_SERVICE_URL}/users/${req.params.id}`);
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
