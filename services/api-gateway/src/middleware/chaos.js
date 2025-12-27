const axios = require('axios');

// Global chaos config state
let chaosConfig = {
  enabled: false,
  error_rate: 0,
  latency_min_ms: 0,
  latency_max_ms: 0,
  timeout_rate: 0
};

// Prometheus metrics
const promClient = require('prom-client');

const chaosLatencyHistogram = new promClient.Histogram({
  name: 'chaos_injected_latency_ms',
  help: 'Latency injected by chaos middleware',
  labelNames: ['service', 'type'],
  buckets: [0, 100, 500, 1000, 2000, 5000]
});

const chaosErrorsTotal = new promClient.Counter({
  name: 'chaos_injected_errors_total',
  help: 'Number of errors injected by chaos',
  labelNames: ['service', 'error_code']
});

const chaosTimeoutsTotal = new promClient.Counter({
  name: 'chaos_injected_timeouts_total',
  help: 'Number of timeouts injected by chaos',
  labelNames: ['service']
});

/**
 * Sync chaos config from chaos-service with retry logic
 */
async function syncChaosConfig(retries = 5, delay = 1000) {
  const chaosServiceUrl = process.env.CHAOS_SERVICE_URL || 'http://chaos-service:8004';
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(`${chaosServiceUrl}/chaos/config`, {
        timeout: 5000
      });
      chaosConfig = response.data.config;
      console.log('[Chaos] Successfully synced config from chaos-service');
      return;
    } catch (error) {
      if (i < retries - 1) {
        console.log(`[Chaos] Retry ${i + 1}/${retries} - Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error('[Chaos] Failed to sync config after retries:', error.message);
      }
    }
  }
}

/**
 * Publish chaos event to Kafka via chaos-service
 */
async function publishChaosEvent(type, details, service) {
  const chaosServiceUrl = process.env.CHAOS_SERVICE_URL || 'http://chaos-service:8004';
  
  try {
    await axios.post(`${chaosServiceUrl}/chaos/event-publish`, {
      chaos_type: type,
      details: details,
      service: service,
      timestamp: new Date().toISOString()
    }, {
      timeout: 5000
    });
  } catch (error) {
    // Fail silently - chaos publishing shouldn't break the app
    console.error('[Chaos] Failed to publish chaos event:', error.message);
  }
}

/**
 * Middleware function to inject chaos into requests
 */
function chaosMiddleware(req, res, next) {
  if (!chaosConfig.enabled) {
    return next();
  }

  const rand = Math.random();
  const service = req.baseUrl.split('/')[2] || 'unknown';

  // Timeout injection
  if (rand < chaosConfig.timeout_rate) {
    const timeoutMs = 30000; // 30 second timeout
    res.setTimeout(timeoutMs, () => {
      chaosTimeoutsTotal.labels(service).inc();
      publishChaosEvent('timeout', `${service} timeout after ${timeoutMs}ms`, service);
      res.status(504).json({ error: 'Gateway Timeout - Chaos Injected' });
    });
  }

  // Error injection
  else if (rand < chaosConfig.error_rate) {
    const errorCodes = [400, 500, 502, 503];
    const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    chaosErrorsTotal.labels(service, errorCode).inc();
    publishChaosEvent('error', `HTTP ${errorCode}`, service);
    return res.status(errorCode).json({ 
      error: 'Chaos Injected Error', 
      code: errorCode 
    });
  }

  // Latency injection
  else if (rand < chaosConfig.error_rate + 0.25) { // 25% latency when errors aren't injected
    const delayMs = Math.random() * 
      (chaosConfig.latency_max_ms - chaosConfig.latency_min_ms) + 
      chaosConfig.latency_min_ms;
    
    chaosLatencyHistogram.labels(service, 'injected').observe(delayMs);
    publishChaosEvent('latency', `${Math.round(delayMs)}ms delay`, service);
    
    // Add chaos delay before continuing
    return setTimeout(next, delayMs);
  }

  next();
}

/**
 * Sync chaos config periodically
 */
setInterval(syncChaosConfig, 5000);

// Initial sync
syncChaosConfig();

module.exports = {
  chaosMiddleware,
  syncChaosConfig,
  publishChaosEvent,
  getChaosConfig: () => chaosConfig,
  setChaosConfig: (config) => { chaosConfig = config; }
};
