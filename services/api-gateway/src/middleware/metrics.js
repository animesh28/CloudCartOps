class ApiGatewayMetrics {
  constructor() {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.requestLatencies = [];
    
    // Status code tracking
    this.statusCodes = {};
    
    // Route tracking
    this.routeMetrics = {};
    
    // Downstream service latencies
    this.downstreamLatencies = {};
    
    // Authentication metrics
    this.authAttempts = 0;
    this.authFailures = 0;
    
    // Rate limiting
    this.rateLimitHits = 0;
  }

  recordRequest(method, path, statusCode, latencyMs) {
    this.totalRequests++;
    this.requestLatencies.push(latencyMs);
    
    // Keep only last 1000 latencies
    if (this.requestLatencies.length > 1000) {
      this.requestLatencies.shift();
    }

    // Track status codes
    if (!this.statusCodes[statusCode]) {
      this.statusCodes[statusCode] = 0;
    }
    this.statusCodes[statusCode]++;

    // Track by route
    const route = `${method} ${path}`;
    if (!this.routeMetrics[route]) {
      this.routeMetrics[route] = { count: 0, totalLatency: 0, errors: 0 };
    }
    this.routeMetrics[route].count++;
    this.routeMetrics[route].totalLatency += latencyMs;

    if (statusCode >= 400) {
      this.failedRequests++;
      this.routeMetrics[route].errors++;
    } else {
      this.successfulRequests++;
    }
  }

  recordDownstreamLatency(service, latencyMs) {
    if (!this.downstreamLatencies[service]) {
      this.downstreamLatencies[service] = [];
    }
    this.downstreamLatencies[service].push(latencyMs);
    
    if (this.downstreamLatencies[service].length > 1000) {
      this.downstreamLatencies[service].shift();
    }
  }

  recordAuthAttempt(success = true) {
    this.authAttempts++;
    if (!success) {
      this.authFailures++;
    }
  }

  recordRateLimitHit() {
    this.rateLimitHits++;
  }

  getAverageLatency() {
    if (this.requestLatencies.length === 0) return 0;
    const sum = this.requestLatencies.reduce((a, b) => a + b, 0);
    return sum / this.requestLatencies.length;
  }

  getP95Latency() {
    if (this.requestLatencies.length < 20) return 0;
    const sorted = [...this.requestLatencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  getP99Latency() {
    if (this.requestLatencies.length < 100) return 0;
    const sorted = [...this.requestLatencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index];
  }

  getErrorRate() {
    if (this.totalRequests === 0) return 0;
    return (this.failedRequests / this.totalRequests) * 100;
  }

  getAuthSuccessRate() {
    if (this.authAttempts === 0) return 100;
    return ((this.authAttempts - this.authFailures) / this.authAttempts) * 100;
  }

  getAverageDownstreamLatency(service) {
    const latencies = this.downstreamLatencies[service];
    if (!latencies || latencies.length === 0) return 0;
    const sum = latencies.reduce((a, b) => a + b, 0);
    return sum / latencies.length;
  }

  getTopRoutes(limit = 5) {
    return Object.entries(this.routeMetrics)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([route, metrics]) => ({
        route,
        requests: metrics.count,
        averageLatency: metrics.totalLatency / metrics.count,
        errors: metrics.errors
      }));
  }

  getSnapshot() {
    const uptime = (Date.now() - this.startTime) / 1000;
    const requestRate = this.totalRequests / uptime;

    return {
      service: 'api-gateway',
      uptime_seconds: uptime,
      total_requests: this.totalRequests,
      successful_requests: this.successfulRequests,
      failed_requests: this.failedRequests,
      error_rate_percent: this.getErrorRate(),
      request_rate_per_sec: requestRate,
      average_latency_ms: this.getAverageLatency(),
      p95_latency_ms: this.getP95Latency(),
      p99_latency_ms: this.getP99Latency(),
      status_codes: this.statusCodes,
      auth_attempts: this.authAttempts,
      auth_failures: this.authFailures,
      auth_success_rate: this.getAuthSuccessRate(),
      rate_limit_hits: this.rateLimitHits,
      downstream_services: Object.keys(this.downstreamLatencies),
      top_routes: this.getTopRoutes(),
      timestamp: new Date().toISOString()
    };
  }
}

const metricsInstance = new ApiGatewayMetrics();

function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsInstance.recordRequest(req.method, req.path, res.statusCode, duration);

    // Log metrics
    console.log(JSON.stringify({
      type: 'request_metric',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }));
  });

  next();
}

function getMetrics() {
  return metricsInstance.getSnapshot();
}

module.exports = metricsMiddleware;
module.exports.getMetrics = getMetrics;
module.exports.recordDownstreamLatency = (service, latency) => metricsInstance.recordDownstreamLatency(service, latency);
module.exports.recordAuthAttempt = (success) => metricsInstance.recordAuthAttempt(success);
module.exports.recordRateLimitHit = () => metricsInstance.recordRateLimitHit();
