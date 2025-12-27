const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const { publishToKafka } = require('../utils/kafka');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

let redisClient;
let store = undefined;

// Create Redis client
async function createRedisClient() {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    console.log('Redis connected for rate limiting');
    // Create store after Redis connection succeeds
    store = new RedisStore({
      client: redisClient,
      prefix: 'rate_limit:'
    });
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    console.log('Falling back to in-memory rate limiting');
    redisClient = null;
  }
}

createRedisClient();

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
  handler: async (req, res) => {
    // Publish rate limit event to Kafka
    try {
      await publishToKafka('api.rate_limited', {
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to publish rate limit event:', error);
    }

    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
});

module.exports = limiter;
