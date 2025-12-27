const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { publishToKafka } = require('../utils/kafka');

const router = express.Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:8001';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await axios.post(`${USER_SERVICE_URL}/users`, {
      username,
      email,
      password,
      full_name
    });

    const token = jwt.sign(
      { user_id: response.data.id, username: response.data.username, is_admin: response.data.is_admin || false },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: response.data.id,
        username: response.data.username,
        email: response.data.email,
        full_name: response.data.full_name,
        is_admin: response.data.is_admin || false
      },
      token
    });
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    // Validate password using user service
    const response = await axios.post(`${USER_SERVICE_URL}/auth/validate-password`, {
      username,
      password
    });

    if (!response.data.valid || !response.data.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = response.data.user;

    const token = jwt.sign(
      { user_id: user.id, username: user.username, is_admin: user.is_admin || false },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_admin: user.is_admin || false
      }
    });
  } catch (error) {
    if (error.response?.status === 404) {
      res.status(401).json({ error: 'Invalid credentials' });
    } else if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

// Validate token
router.get('/validate', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user data from user service
    try {
      const response = await axios.get(`${USER_SERVICE_URL}/users/${decoded.user_id}`);
      res.json({ 
        valid: true, 
        user: {
          id: response.data.id,
          username: response.data.username,
          email: response.data.email,
          full_name: response.data.full_name,
          is_admin: response.data.is_admin || false
        }
      });
    } catch (error) {
      res.status(401).json({ valid: false, error: 'User not found' });
    }
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

module.exports = router;
