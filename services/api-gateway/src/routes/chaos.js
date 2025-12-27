const express = require('express');
const axios = require('axios');

const router = express.Router();

const CHAOS_SERVICE_URL = process.env.CHAOS_SERVICE_URL || 'http://chaos-service:8004';

/**
 * GET /chaos/config
 * Proxy to chaos service to get current chaos configuration
 */
router.get('/config', async (req, res) => {
  try {
    const response = await axios.get(`${CHAOS_SERVICE_URL}/chaos/config`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error fetching config:', error.message);
    res.status(500).json({
      error: 'Failed to fetch chaos config',
      message: error.message
    });
  }
});

/**
 * POST /chaos/inject/latency
 * Proxy to inject latency into chaos service
 */
router.post('/inject/latency', async (req, res) => {
  try {
    const response = await axios.post(`${CHAOS_SERVICE_URL}/chaos/inject/latency`, req.body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error injecting latency:', error.message);
    res.status(500).json({
      error: 'Failed to inject latency',
      message: error.message
    });
  }
});

/**
 * POST /chaos/inject/error
 * Proxy to inject errors into chaos service
 */
router.post('/inject/error', async (req, res) => {
  try {
    const response = await axios.post(`${CHAOS_SERVICE_URL}/chaos/inject/error`, req.body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error injecting error:', error.message);
    res.status(500).json({
      error: 'Failed to inject error',
      message: error.message
    });
  }
});

/**
 * POST /chaos/inject/random
 * Proxy to inject random chaos
 */
router.post('/inject/random', async (req, res) => {
  try {
    const response = await axios.post(`${CHAOS_SERVICE_URL}/chaos/inject/random`, {}, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error injecting random chaos:', error.message);
    res.status(500).json({
      error: 'Failed to inject random chaos',
      message: error.message
    });
  }
});

/**
 * GET /chaos/test/slow
 * Proxy to test slow endpoint
 */
router.get('/test/slow', async (req, res) => {
  try {
    const response = await axios.get(`${CHAOS_SERVICE_URL}/chaos/test/slow`, {
      timeout: 35000
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error testing slow endpoint:', error.message);
    res.status(500).json({
      error: 'Failed to test slow endpoint',
      message: error.message
    });
  }
});

/**
 * GET /chaos/test/error
 * Proxy to test error endpoint
 */
router.get('/test/error', async (req, res) => {
  try {
    const response = await axios.get(`${CHAOS_SERVICE_URL}/chaos/test/error`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error testing error endpoint:', error.message);
    res.status(500).json({
      error: 'Failed to test error endpoint',
      message: error.message
    });
  }
});

/**
 * GET /chaos/test/memory-leak
 * Proxy to test memory leak endpoint
 */
router.get('/test/memory-leak', async (req, res) => {
  try {
    const response = await axios.get(`${CHAOS_SERVICE_URL}/chaos/test/memory-leak`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error testing memory leak:', error.message);
    res.status(500).json({
      error: 'Failed to test memory leak',
      message: error.message
    });
  }
});

/**
 * POST /chaos/enable
 * Proxy to enable chaos service
 */
router.post('/enable', async (req, res) => {
  try {
    const response = await axios.post(`${CHAOS_SERVICE_URL}/chaos/enable`, {}, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error enabling chaos:', error.message);
    res.status(500).json({
      error: 'Failed to enable chaos',
      message: error.message
    });
  }
});

/**
 * POST /chaos/disable
 * Proxy to disable chaos service
 */
router.post('/disable', async (req, res) => {
  try {
    const response = await axios.post(`${CHAOS_SERVICE_URL}/chaos/disable`, {}, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Chaos API] Error disabling chaos:', error.message);
    res.status(500).json({
      error: 'Failed to disable chaos',
      message: error.message
    });
  }
});

module.exports = router;
