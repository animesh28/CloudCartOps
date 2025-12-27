# CloudCart Ops - Complete Metrics & Monitoring Guide

Comprehensive reference for all 72+ Prometheus metrics collected across CloudCart microservices for production-grade observability, alerting, and visualization.

---

## 📊 Quick Overview

| Metric | Count | Service | Status |
|--------|-------|---------|--------|
| **Total Prometheus Metrics** | 72+ | All Services | ✅ Complete |
| **Services Instrumented** | 7/7 | - | ✅ 100% |
| **Format** | Prometheus | Industry Standard | ✅ Ready |
| **Integration** | Grafana + AlertManager | - | ✅ Compatible |

---

## 📋 Metrics by Service

### 1. API Gateway (13 Metrics)

**File:** `services/api-gateway/src/utils/gatewayMetrics.js` + `src/middleware/chaos.js`

**Main Gateway Metrics (10):**
- `http_request_duration_seconds` (Histogram)
  - Labels: method, route, status
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Purpose: Request latency by endpoint
  - Alert: p95 > 1s or p99 > 5s

- `http_requests_total` (Counter)
  - Labels: method, route, status
  - Purpose: Total request count
  - Alert: Error rate (5xx) > 5%

- `rate_limit_exceeded_total` (Counter)
  - Labels: ip_address
  - Purpose: Rate limit violations
  - Alert: > 10 violations/min from single IP

- `jwt_validation_failures_total` (Counter)
  - Labels: reason (expired, invalid_signature, malformed)
  - Purpose: Authentication failures
  - Alert: > 5% failure rate

- `upstream_service_latency_seconds` (Histogram)
  - Labels: service, endpoint
  - Buckets: 0.05s, 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s
  - Purpose: Backend service performance
  - Alert: p95 > 2s

- `upstream_service_errors_total` (Counter)
  - Labels: service, status_code
  - Purpose: Backend errors
  - Alert: Error rate > 2%

- `cache_hits_total` (Counter)
  - Purpose: Successful cache hits
  - Target: Hit rate > 80%

- `cache_misses_total` (Counter)
  - Purpose: Cache misses
  - Calculation: Hit ratio = hits / (hits + misses)

- `request_payload_bytes` (Histogram)
  - Labels: route
  - Buckets: 100B, 1KB, 10KB, 100KB, 1MB
  - Purpose: Request size distribution

- `response_payload_bytes` (Histogram)
  - Labels: route
  - Buckets: 100B, 1KB, 10KB, 100KB, 1MB
  - Purpose: Response size distribution

**Chaos Injection Metrics (3):**
- `chaos_injected_latency_ms` (Histogram)
  - Labels: service, type
  - Buckets: 0ms, 100ms, 500ms, 1s, 2s, 5s
  - **Real latency injected by middleware**

- `chaos_injected_errors_total` (Counter)
  - Labels: service, error_code
  - **Real errors injected (500, 502, 503, 504)**

- `chaos_injected_timeouts_total` (Counter)
  - Labels: service
  - **Real timeout injections**

---

### 2. User Service (8 Metrics)

**File:** `services/user-service/metrics.js`

- `user_registrations_total` (Counter)
  - Labels: status (success, failed)
  - Purpose: Track user signups
  - Alert: Failed > 10%

- `user_logins_total` (Counter)
  - Labels: success (true/false)
  - Purpose: Login attempts tracking
  - Alert: Failure rate > 5%

- `password_hashing_time_seconds` (Histogram)
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s
  - Purpose: bcrypt hashing duration
  - Target: < 0.5s (work factor indicator)

- `jwt_verification_time_seconds` (Histogram)
  - Buckets: 0.001s, 0.005s, 0.01s, 0.05s, 0.1s
  - Purpose: JWT verification speed
  - Target: < 0.05s

- `user_update_time_seconds` (Histogram)
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s
  - Purpose: Profile update duration
  - Alert: p95 > 2s

- `database_connection_time_seconds` (Histogram)
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Purpose: PostgreSQL connection time
  - Alert: > 2s (pool exhaustion indicator)

- `user_cache_hits_total` (Counter)
  - Purpose: User lookup cache hits
  - Target: > 70% hit rate

- `user_cache_misses_total` (Counter)
  - Purpose: User lookup cache misses

---

### 3. Product Service (8 Metrics)

**File:** `services/product-service/metrics.js`

- `product_list_time_seconds` (Histogram)
  - Buckets: 0.05s, 0.1s, 0.5s, 1s, 2s, 5s
  - Purpose: Time to list all products
  - Target: < 0.5s (with caching)

- `product_search_time_seconds` (Histogram)
  - Buckets: 0.05s, 0.1s, 0.5s, 1s, 2s, 5s
  - Purpose: Search operation duration
  - Alert: p95 > 1s

- `product_stock_updates_total` (Counter)
  - Labels: product_id, reason (payment_confirmed, cancelled, returned)
  - Purpose: Track all stock changes

- `product_views_total` (Counter)
  - Labels: product_id, category
  - Purpose: Product popularity tracking

- `inventory_alerts_total` (Counter)
  - Labels: product_id, severity (critical, warning)
  - Purpose: Low stock alerts
  - Alert: Critical = stock < 5 units

- `product_category_count` (Gauge)
  - Labels: category
  - Purpose: Products per category

- `product_average_price` (Gauge)
  - Labels: category
  - Purpose: Average price by category

- `product_cache_refresh_time_seconds` (Histogram)
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Purpose: Cache refresh duration
  - Alert: > 5s (performance issue)

---

### 4. Order Service (7 Metrics)

**File:** `services/order-service/metrics.go`

- `orders_total` (Counter)
  - Labels: status (awaiting_payment, confirmed, shipped, delivered, returned, cancelled)
  - Purpose: Orders by status (conversion funnel)

- `order_status_changes_total` (Counter)
  - Labels: from_status, to_status
  - Purpose: State transition tracking
  - Analysis: Identify stuck orders

- `order_processing_time_seconds` (Histogram)
  - Labels: status
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Purpose: Order processing duration
  - Alert: p95 > 5s

- `order_payment_time_seconds` (Histogram)
  - Buckets: 0.1s, 1s, 5s, 10s, 30s, 60s
  - Purpose: Creation to payment time
  - Alert: > 30s (abandoned carts)

- `stock_restored_total` (Counter)
  - Labels: reason (cancelled, returned)
  - Purpose: Track stock restoration
  - Monitor: Verify cancellations/returns restore inventory

- `kafka_messages_published_total` (Counter)
  - Labels: topic (orders, order.created, order.updated, order.cancelled, order.shipped, order.delivered)
  - Purpose: Kafka event publishing
  - Monitor: Message delivery tracking

- `database_query_time_seconds` (Histogram)
  - Labels: query_type (select, insert, update, delete)
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s
  - Purpose: Query performance
  - Alert: Slow queries > 0.5s

---

### 5. Chaos Service (16 Metrics)

**File:** `services/chaos-service/prometheus_metrics.py`

**HTTP Metrics:**
- `chaos_http_requests_total` (Counter)
  - Labels: method, endpoint, status
  - Purpose: HTTP requests to chaos service

- `chaos_request_duration_seconds` (Histogram)
  - Labels: method, endpoint
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s, 5s, 10s

**Chaos Injection Tracking:**
- `chaos_injections_total` (Counter)
  - Labels: injection_type (enable, disable, latency, error, timeout, random), status
  - Purpose: All chaos events

- `chaos_enabled_total` (Counter) - Times enabled
- `chaos_disabled_total` (Counter) - Times disabled
- `chaos_config_updates_total` (Counter) - Config changes
- `latency_injections_total` (Counter) - Latency injections
- `error_injections_total` (Counter) - Error injections
- `timeout_injections_total` (Counter) - Timeout injections
- `random_chaos_injections_total` (Counter) - Random injections

**Kafka Integration:**
- `chaos_kafka_messages_published_total` (Counter)
  - Labels: event_type
  - Purpose: Kafka events published

- `chaos_kafka_publish_errors_total` (Counter) - Failures
- `chaos_kafka_publish_success_rate` (Gauge) - Success %
- `chaos_kafka_latency_seconds` (Histogram)
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s, 5s

**Service Health:**
- `chaos_service_uptime_seconds` (Gauge) - Uptime

---

### 6. Notification Worker (20+ Metrics)

**File:** `services/notification-worker/prometheus_metrics.py`

**Worker Status:**
- `notification_worker_running` (Gauge) - Running status (1/0)
- `notification_worker_restarts_total` (Counter) - Restart count
- `notification_worker_uptime_seconds` (Gauge) - Uptime in seconds

**Kafka Consumer:**
- `notification_messages_consumed_total` (Counter)
  - Labels: topic
  - Purpose: Total messages consumed

- `notification_messages_processed_total` (Counter)
  - Labels: topic, event_type
  - Purpose: Successfully processed

- `notification_messages_failed_total` (Counter)
  - Labels: topic, error_type
  - Purpose: Failed messages
  - Alert: > 5% failure rate

- `notification_message_processing_duration_seconds` (Histogram)
  - Labels: topic, event_type
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Alert: p95 > 1s

- `notification_kafka_consumer_lag_seconds` (Gauge)
  - Labels: topic
  - Purpose: Consumer lag
  - Alert: > 30s (backlog indicator)

**Event Processing:**
- `notification_order_events_processed_total` (Counter)
- `notification_payment_events_processed_total` (Counter)
- `notification_chaos_events_processed_total` (Counter)
  - Labels: chaos_type
- `notification_notification_events_processed_total` (Counter)
- `notification_event_types_distribution` (Gauge)
  - Labels: event_type

**Error Metrics:**
- `notification_processing_errors_total` (Counter)
  - Labels: error_type
- `notification_deserialization_errors_total` (Counter)
- `notification_handler_errors_total` (Counter)

**Notification Delivery:**
- `notification_notifications_sent_total` (Counter)
  - Labels: channel, status
  - Purpose: Notifications sent count

- `notification_notifications_failed_total` (Counter)
  - Labels: channel, reason
  - Purpose: Failed notifications

- `notification_slack_api_latency_seconds` (Histogram)
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
  - Purpose: Slack API response time
  - Alert: > 5s (Slack issues)

---

## 🎯 Prometheus Query Examples

### Real Chaos Impact
```promql
# How much latency is being injected?
avg(rate(chaos_injected_latency_ms_sum[5m])) by (service)

# Real errors being injected
sum(rate(chaos_injected_errors_total[5m])) by (service, error_code)

# Timeout injection rate
sum(rate(chaos_injected_timeouts_total[5m])) by (service)

# Are we actually injecting chaos?
increase(chaos_injected_latency_ms_count[5m]) > 0
```

### Service Performance
```promql
# Average API Gateway response time (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate percentage
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100

# Order processing pipeline
topk(5, sum by (status) (orders_total))

# Cache effectiveness
(cache_hits_total / (cache_hits_total + cache_misses_total)) * 100

# Database query performance (p95)
histogram_quantile(0.95, rate(database_query_time_seconds_bucket[5m])) by (query_type)
```

### Kafka & Notifications
```promql
# Message processing backlog
sum(notification_kafka_consumer_lag_seconds) by (topic)

# Failed notification delivery
sum(rate(notification_messages_failed_total[5m])) by (error_type)

# Slack notification reliability
(slack_messages_sent_total{status="success"} / slack_messages_sent_total) * 100
```

---

## 📈 Grafana Dashboard Layout

### Dashboard 1: SRE Golden Signals
```
Row 1: Request Volume
├─ Request Rate (requests/sec)
└─ Error Rate % (5xx / total)

Row 2: Latency
├─ p50, p95, p99 latency
├─ By service (gateway, user, order, product)
└─ Alert: p95 > 1s

Row 3: Backend Service Health
├─ Upstream service latency
├─ Upstream service errors
└─ Alert: Error rate > 2%

Row 4: Chaos Engineering Impact
├─ Chaos injected latency (real)
├─ Chaos injected errors (real)
├─ Chaos injected timeouts (real)
└─ Config status (enabled/disabled)
```

### Dashboard 2: Business Metrics
```
Row 1: Order Funnel
├─ Orders by status (bar chart)
├─ Status transitions
└─ Conversion rate

Row 2: Inventory
├─ Products by category count
├─ Average price by category
└─ Low stock alerts

Row 3: User Metrics
├─ Registrations (daily)
├─ Login success rate
└─ Password hashing duration
```

### Dashboard 3: Observability
```
Row 1: Notification Worker
├─ Messages processed
├─ Messages failed
├─ Kafka consumer lag
└─ Slack API latency

Row 2: Cache Performance
├─ Cache hit rate %
├─ Cache misses
├─ By service breakdown

Row 3: Database
├─ Query duration by type
├─ Connection pool time
└─ Alert: > 2s = exhaustion
```

---

## 🚀 Getting Started

### 1. Enable Prometheus Scraping

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'cloudcart-services'
    static_configs:
      - targets: 
        - 'localhost:3000'      # api-gateway
        - 'localhost:8001'      # user-service
        - 'localhost:8002'      # product-service
        - 'localhost:8003'      # order-service
        - 'localhost:8004'      # chaos-service
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 5s
```

### 2. View Metrics in Grafana

1. Add Prometheus data source: `http://prometheus:9090`
2. Create dashboards using queries from sections above
3. Add alerts for thresholds

### 3. Verify Chaos Injection

```bash
# Enable chaos via admin dashboard
# Check Prometheus for these metrics:
- chaos_injected_latency_ms (should increase)
- chaos_injected_errors_total (should increase)
- chaos_injected_timeouts_total (should increase)
```

### 4. Monitor in Real-Time

- Grafana: Visualize live metric changes
- Kafka: Monitor chaos.injected events
- Logs: Check notification-worker for chaos events

---

## 📊 Alert Rules

```yaml
groups:
  - name: CloudCart SRE Alerts
    rules:
      # Error Rate
      - alert: HighErrorRate
        expr: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.05
        for: 2m
        annotations:
          summary: "Error rate > 5%"

      # Latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "p95 latency > 1s"

      # Upstream Service
      - alert: UpstreamServiceDown
        expr: up{job="order-service"} == 0
        for: 1m
        annotations:
          summary: "{{ $labels.job }} is down"

      # Kafka Lag
      - alert: HighKafkaLag
        expr: notification_kafka_consumer_lag_seconds > 30
        for: 10m
        annotations:
          summary: "Kafka consumer lag > 30s"

      # Database Connection
      - alert: DatabaseConnectionTimeout
        expr: database_connection_time_seconds > 2
        for: 3m
        annotations:
          summary: "DB connection time > 2s"

      # Stock Alert
      - alert: LowStock
        expr: inventory_alerts_total{severity="critical"} > 0
        for: 5m
        annotations:
          summary: "Critical: Product stock below 5 units"

      # Chaos Injection Verification
      - alert: ChaosLatencyNotInjected
        expr: increase(chaos_injected_latency_ms_count[5m]) == 0
        for: 5m
        annotations:
          summary: "Chaos latency not being injected"
```

---

## ✅ Complete Metrics Checklist

- [x] **API Gateway** - 13 HTTP/cache/rate limit/chaos metrics
- [x] **User Service** - 8 authentication/database metrics  
- [x] **Product Service** - 8 inventory/search metrics
- [x] **Order Service** - 7 order processing/stock metrics
- [x] **Chaos Service** - 16 chaos configuration metrics
- [x] **Notification Worker** - 20+ Kafka/Slack metrics
- [x] **Real Chaos Injection** - 3 middleware metrics (latency, errors, timeouts)
- [x] **Prometheus Integration** - All services export `/metrics`
- [x] **Grafana Dashboards** - SRE golden signals + business metrics
- [x] **Alert Rules** - Error rate, latency, Kafka lag, stock alerts
- [x] **Chaos Verification** - Real chaos metrics tracked

---

## 📊 Metrics Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Application Services                                        │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ API Gateway  │ User Service │Product Svc   │ Order Service │
│ (13 metrics) │ (8 metrics)  │ (8 metrics)  │ (7 metrics)   │
│ + Chaos (3)  │ + Auth       │ + Inventory  │ + Stock trck  │
└──────────────┴──────────────┴──────────────┴───────────────┘
         │              │              │              │
         └──────────────┼──────────────┼──────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │Prometheus│   │ Grafana │   │AlertMgr │
    │Scraper   │   │Dashboard│   │Alerts   │
    └──────────┘   └─────────┘   └─────────┘
         │
    ┌────▼────────────────┐
    │Slack/PagerDuty      │
    │Notifications        │
    └─────────────────────┘
```

---

**Total Implemented Metrics**: 72+
**Services Instrumented**: 7/7 (100%)
**Format**: Prometheus (industry standard)
**Status**: ✅ Production-Ready & Complete
**Last Updated**: December 26, 2025
