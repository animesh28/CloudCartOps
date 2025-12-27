const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// API Gateway Metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency by route',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const rateLimitExceeded = new promClient.Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['ip_address'],
  registers: [register]
});

const jwtValidationFailures = new promClient.Counter({
  name: 'jwt_validation_failures_total',
  help: 'Total JWT validation failures',
  labelNames: ['reason'],
  registers: [register]
});

const upstreamServiceLatency = new promClient.Histogram({
  name: 'upstream_service_latency_seconds',
  help: 'Latency to upstream services',
  labelNames: ['service', 'endpoint'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const upstreamServiceErrors = new promClient.Counter({
  name: 'upstream_service_errors_total',
  help: 'Total errors from upstream services',
  labelNames: ['service', 'status_code'],
  registers: [register]
});

const cacheHitRate = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  registers: [register]
});

const cacheMissRate = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  registers: [register]
});

const requestPayloadSize = new promClient.Histogram({
  name: 'request_payload_bytes',
  help: 'HTTP request payload size in bytes',
  labelNames: ['route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

const responsePayloadSize = new promClient.Histogram({
  name: 'response_payload_bytes',
  help: 'HTTP response payload size in bytes',
  labelNames: ['route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  rateLimitExceeded,
  jwtValidationFailures,
  upstreamServiceLatency,
  upstreamServiceErrors,
  cacheHitRate,
  cacheMissRate,
  requestPayloadSize,
  responsePayloadSize,
  
  recordRequest(method, route, status, duration) {
    httpRequestDuration.labels(method, route, status).observe(duration);
    httpRequestsTotal.labels(method, route, status).inc();
  },
  
  recordUpstreamCall(service, endpoint, duration, status) {
    upstreamServiceLatency.labels(service, endpoint).observe(duration);
    if (status >= 400) {
      upstreamServiceErrors.labels(service, status).inc();
    }
  },
  
  recordCacheHit() {
    cacheHitRate.inc();
  },
  
  recordCacheMiss() {
    cacheMissRate.inc();
  }
};
      cacheMissRate,
      requestPayloadSize,
      responsePayloadSize
    ];
  }
};
