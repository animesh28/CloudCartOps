# CloudCartOps – Prometheus Metrics Reference

Complete reference for every Prometheus metric exposed by CloudCartOps services, with Prometheus‑native interpretations and example queries.
---

## 1. Global View

- **Scrape target:** every service exposes metrics at `GET /metrics` in Prometheus text format.
- **Services with metrics:**
  - API Gateway (Node.js)
  - User Service (Python/FastAPI)
  - Product Service (Python/Flask)
  - Order Service (Go)
  - Chaos Service (Python/Flask)
  - Notification Worker (Python worker)
  - Metrics Aggregator (Python; exports synthesized service‑level metrics)
- **Prometheus config:** see `prometheus/prometheus.yml`.

### 1.1 Metric Types (Prometheus‑native)

- **Counter** – a value that only ever goes **up** (except when a process restarts).
  - Use `rate(counter_name[5m])` or `increase(counter_name[5m])` to see *per‑second rate* or *total increase* over a time window.
- **Gauge** – a value that can go **up and down** (current temperature, in‑flight requests, queue depth, etc.).
  - Use `max`, `avg`, or `min` across labels or over time windows.
- **Histogram** – records **distributions** (typically latencies or sizes) into **buckets** plus `_sum` and `_count`.
  - Query percentiles with `histogram_quantile()` on `*_bucket` time series.
  - Example: `histogram_quantile(0.95, rate(user_request_duration_seconds_bucket[5m]))`.

All histograms defined in this repo follow the normal Prometheus pattern and automatically create these series:

- `<base_name>_bucket{le="..."}`
- `<base_name>_sum`
- `<base_name>_count`

---

## 2. API Gateway Metrics

**Files**
- Implementation: `services/api-gateway/src/utils/gatewayMetrics.js`
- Endpoint wiring: `services/api-gateway/src/index.js`

**Endpoint**
- `GET /metrics`
- Includes **Node process default metrics** from `prom-client.collectDefaultMetrics` (CPU, memory, garbage collection, etc.) plus the custom metrics below.

### 2.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status` | Latency of HTTP requests handled by the gateway. |
| `http_requests_total` | Counter | `method`, `route`, `status` | Total number of HTTP requests through the gateway. |
| `rate_limit_exceeded_total` | Counter | `ip_address` | Number of requests rejected due to rate limiting. |
| `jwt_validation_failures_total` | Counter | `reason` | Failed JWT validations by failure reason (expired, malformed, invalid signature, etc.). |
| `upstream_service_latency_seconds` | Histogram | `service`, `endpoint` | Latency for calls from gateway to backend services. |
| `upstream_service_errors_total` | Counter | `service`, `status_code` | Upstream errors (4xx/5xx) returned by backend services. |
| `cache_hits_total` | Counter | – | Number of cache hits in gateway‑level caching. |
| `cache_misses_total` | Counter | – | Number of cache misses. |
| `request_payload_bytes` | Histogram | `route` | Size of incoming HTTP request bodies. |
| `response_payload_bytes` | Histogram | `route` | Size of outgoing HTTP responses. |

### 2.2 Prometheus‑native Interpretation & Queries

**Request volume & error rate**

```promql
# Requests per second by route
sum by (route) (rate(http_requests_total[5m]))

# Gateway error percentage (5xx only)
(sum(rate(http_requests_total{status=~"5.."}[5m]))
 /
 sum(rate(http_requests_total[5m]))) * 100
```

**Latency (SLOs) using histograms**

```promql
# p95 latency per route
histogram_quantile(0.95,
  sum by (route, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# p99 latency per upstream service
histogram_quantile(0.99,
  sum by (service, le) (rate(upstream_service_latency_seconds_bucket[5m]))
)
```

**Cache efficiency**

```promql
# Cache hit ratio
(rate(cache_hits_total[5m])
 /
 (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 100
```

**Auth and rate limiting**

```promql
# JWT validation failures by reason
sum(rate(jwt_validation_failures_total[5m])) by (reason)

# Top offending IPs by rate limit violations
topk(10, rate(rate_limit_exceeded_total[5m]))
```

---

## 3. User Service Metrics

**Files**
- Metrics definition: `services/user-service/prometheus_metrics.py`
- Service: `services/user-service/main.py`

**Endpoint**
- `GET /metrics`
- Uses a **custom `CollectorRegistry`** so the user service exposes only its own metrics.

### 3.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `user_http_requests_total` | Counter | `method`, `endpoint`, `status` | All HTTP requests hitting the user service. |
| `user_request_duration_seconds` | Histogram | `method`, `endpoint` | End‑to‑end latency of user‑service HTTP handlers. |
| `user_registrations_total` | Counter | `status` | User registration attempts by status (`success`, `failed`, etc.). |
| `user_logins_total` | Counter | `success` | Login attempts split by success flag (`true`/`false`). |
| `password_hashing_duration_seconds` | Histogram | – | Duration of password hashing (e.g., bcrypt). |
| `password_validation_duration_seconds` | Histogram | – | Time taken to verify provided passwords. |
| `user_update_duration_seconds` | Histogram | – | Time spent updating user profiles. |
| `user_db_query_duration_seconds` | Histogram | `query_type` | Database query latency (`select`, `insert`, `update`, etc.). |
| `user_db_connection_errors_total` | Counter | – | Count of DB connection failures. |
| `total_users_count` | Gauge | – | Current total number of registered users. |
| `active_users_count` | Gauge | – | Number of active users (as defined by the service). |
| `admin_users_count` | Gauge | – | Number of admin users. |
| `user_auth_failures_total` | Counter | `reason` | Auth failures (bad password, invalid token, etc.). |
| `user_auth_success_total` | Counter | – | Successful auth events. |
| `user_kafka_events_published_total` | Counter | `event_type`, `status` | Kafka events published by the user service (by type & success status). |
| `user_kafka_publish_duration_seconds` | Histogram | `event_type` | Kafka publish latency per event type. |
| `user_errors_total` | Counter | `error_type`, `endpoint` | Application‑level errors in the user service. |

### 3.2 Prometheus‑native Interpretation & Queries

**Login/registration funnel**

```promql
# Successful vs failed registrations
sum(rate(user_registrations_total[5m])) by (status)

# Login failure rate
(sum(rate(user_logins_total{success="false"}[5m]))
 /
 sum(rate(user_logins_total[5m]))) * 100
```

**Password hashing latency**

```promql
# p95 password hashing time
histogram_quantile(0.95,
  rate(password_hashing_duration_seconds_bucket[5m])
)
```

**DB performance & reliability**

```promql
# Slow query latency by type
histogram_quantile(0.95,
  sum by (query_type, le) (rate(user_db_query_duration_seconds_bucket[5m]))
)

# DB connection error rate
rate(user_db_connection_errors_total[5m])
```

**User population gauges**

```promql
total_users_count
active_users_count
admin_users_count
```

Because these are gauges, you typically plot them as **raw values** or use functions like `deriv()` if you care about growth rate.

---

## 4. Product Service Metrics

**Files**
- Metrics definition: `services/product-service/prometheus_metrics.py`
- Service: `services/product-service/app.py`

**Endpoint**
- `GET /metrics`

### 4.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `product_http_requests_total` | Counter | `method`, `endpoint`, `status` | HTTP requests handled by the product service. |
| `product_request_duration_seconds` | Histogram | `method`, `endpoint` | Latency of product‑service HTTP handlers. |
| `product_list_time_seconds` | Histogram | `category` | Time to fetch product lists, per category. |
| `product_search_time_seconds` | Histogram | – | Time spent in product search operations. |
| `product_views_total` | Counter | `product_id`, `category` | Product page views by ID and category. |
| `product_stock_updates_total` | Counter | `product_id`, `reason` | Stock changes (e.g., purchase, cancellation, return). |
| `inventory_alerts_total` | Counter | `product_id`, `severity` | Low‑stock or inventory health alerts. |
| `product_db_query_duration_seconds` | Histogram | `query_type` | DB query latency for product operations. |
| `product_db_connection_pool_size` | Gauge | – | Current DB connection pool size. |
| `products_count_by_category` | Gauge | `category` | Number of products per category. |
| `product_average_price_dollars` | Gauge | `category` | Average product price per category. |
| `low_stock_products_count` | Gauge | – | Number of products below low‑stock threshold. |
| `product_kafka_events_published_total` | Counter | `event_type`, `status` | Kafka events published by product‑service. |
| `product_kafka_publish_duration_seconds` | Histogram | `event_type` | Kafka publish latency for product events. |
| `product_errors_total` | Counter | `error_type`, `endpoint` | Product‑service error occurrences. |

### 4.2 Prometheus‑native Interpretation & Queries

**Product catalog health**

```promql
# Number of products per category
products_count_by_category

# Low stock products (absolute count)
low_stock_products_count
```

**Product popularity & inventory pressure**

```promql
# Top 10 viewed products
topk(10,
  sum(rate(product_views_total[5m])) by (product_id)
)

# Stock update rate by reason
sum(rate(product_stock_updates_total[5m])) by (reason)
```

**Latency for product list/search**

```promql
# p95 list latency for each category
histogram_quantile(0.95,
  sum by (category, le) (rate(product_list_time_seconds_bucket[5m]))
)

# p95 search latency (global)
histogram_quantile(0.95,
  rate(product_search_time_seconds_bucket[5m])
)
```

---

## 5. Order Service Metrics

**Files**
- Metrics & HTTP wiring: `services/order-service/main.go`

**Endpoint**
- `GET /metrics` (served by `promhttp.Handler()`)

### 5.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `order_http_requests_total` | Counter | `method`, `endpoint`, `status` | Total HTTP requests to the order service. |
| `order_http_request_duration_seconds` | Histogram | `method`, `endpoint` | HTTP handler latency in the order service. |
| `orders_created_total` | Counter | – | Number of orders created (all statuses). |
| `orders_cancelled_total` | Counter | – | Number of orders cancelled. |
| `orders_completed_total` | Counter | – | Number of orders completed (delivered). |
| `order_payments_processed_total` | Counter | `status` | Payments processed, labeled by status (`success`, `failed`, etc.). |
| `order_processing_duration_seconds` | Histogram | – | Time to process order creation. |
| `order_db_query_duration_seconds` | Histogram | `query_type` | DB query latency in the order service. |
| `order_kafka_publish_duration_seconds` | Histogram | `event_type` | Kafka publish latency for order events. |
| `order_errors_total` | Counter | `error_type`, `endpoint` | Errors in the order service. |

> Note: Order items and product names are stored in the DB and surfaced in JSON responses, but they are not separate metrics; use the order metrics above for pipeline‑level observability.

### 5.2 Prometheus‑native Interpretation & Queries

**Order funnel & business KPIs**

```promql
# Order creation rate
rate(orders_created_total[5m])

# Completion vs cancellation (conversion health)
sum(rate(orders_completed_total[5m]))
/
sum(rate(orders_created_total[5m]))

sum(rate(orders_cancelled_total[5m]))
/
sum(rate(orders_created_total[5m]))
```

**Payment pipeline health**

```promql
# Payments by status
sum(rate(order_payments_processed_total[5m])) by (status)
```

**Order service performance**

```promql
# p95 order processing latency
histogram_quantile(0.95,
  rate(order_processing_duration_seconds_bucket[5m])
)

# DB query latency
histogram_quantile(0.95,
  sum by (query_type, le) (rate(order_db_query_duration_seconds_bucket[5m]))
)
```

---

## 6. Chaos Service Metrics

**Files**
- Metrics definition: `services/chaos-service/prometheus_metrics.py`
- Service: `services/chaos-service/main.py` (exposes `/metrics`)

### 6.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `chaos_http_requests_total` | Counter | `method`, `endpoint`, `status` | HTTP traffic to the chaos service API. |
| `chaos_request_duration_seconds` | Histogram | `method`, `endpoint` | Latency of chaos service HTTP operations. |
| `chaos_injections_total` | Counter | `injection_type`, `status` | All chaos injections (enable, disable, latency, error, timeout, random) and their status. |
| `chaos_enabled_total` | Counter | – | Number of times chaos was enabled. |
| `chaos_disabled_total` | Counter | – | Number of times chaos was disabled. |
| `chaos_config_updates_total` | Counter | – | Configuration updates to chaos settings. |
| `latency_injections_total` | Counter | – | Number of latency injections performed. |
| `latency_injection_duration_ms` | Histogram | – | Magnitude of injected latency in milliseconds. |
| `error_injections_total` | Counter | `error_code` | Injected error responses by status code (e.g., 500, 503). |
| `timeout_injections_total` | Counter | – | Number of timeout injections. |
| `random_chaos_injections_total` | Counter | – | Number of random chaos injections. |
| `chaos_kafka_messages_published_total` | Counter | `event_type` | Kafka messages published by the chaos service. |
| `chaos_kafka_publish_errors_total` | Counter | – | Kafka publish failures from chaos service. |
| `chaos_kafka_publish_success_rate` | Gauge | – | Computed Kafka publish success rate (percentage). |
| `chaos_kafka_latency_seconds` | Histogram | – | Kafka publish latency. |
| `chaos_service_uptime_seconds` | Gauge | – | Uptime of the chaos service in seconds. |

### 6.2 Prometheus‑native Interpretation & Queries

**Are we actually injecting chaos?**

```promql
# Overall chaos activity
sum(rate(chaos_injections_total[5m])) by (injection_type)

# Magnitude of injected latency (average over 5m)
rate(latency_injection_duration_ms_sum[5m])
 /
 rate(latency_injection_duration_ms_count[5m])
```

**Impact on system reliability**

You can directly correlate chaos metrics with gateway or service‑level metrics, for example:

```promql
# Correlate error injections with gateway 5xx rate
sum(rate(error_injections_total[5m]))
and
sum(rate(http_requests_total{status=~"5.."}[5m])) by (route)
```

**Kafka reliability from chaos service**

```promql
# Kafka publish error rate
rate(chaos_kafka_publish_errors_total[5m])

# Success rate gauge (already a percentage)
chaos_kafka_publish_success_rate
```

---

## 7. Notification Worker Metrics

**Files**
- Metrics definition: `services/notification-worker/prometheus_metrics.py`
- Worker: `services/notification-worker/worker.py` (uses `start_http_server` to expose `/metrics`).

### 7.1 Metric Catalog

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `notification_worker_running` | Gauge | – | 1 if worker is running, 0 if not. |
| `notification_worker_restarts_total` | Counter | – | Number of worker restarts. |
| `notification_worker_uptime_seconds` | Gauge | – | Worker uptime in seconds. |
| `notification_messages_consumed_total` | Counter | `topic` | Kafka messages consumed by topic. |
| `notification_messages_processed_total` | Counter | `topic`, `event_type` | Successfully processed messages. |
| `notification_messages_failed_total` | Counter | `topic`, `error_type` | Messages that failed processing. |
| `notification_message_processing_duration_seconds` | Histogram | `topic`, `event_type` | Processing time per message. |
| `notification_kafka_consumer_lag_seconds` | Gauge | `topic` | Consumer lag in seconds. |
| `notification_order_events_processed_total` | Counter | – | Number of order‑related events handled. |
| `notification_payment_events_processed_total` | Counter | – | Number of payment‑related events handled. |
| `notification_chaos_events_processed_total` | Counter | `chaos_type` | Chaos‑related events handled. |
| `notification_notification_events_processed_total` | Counter | – | Notification events handled. |
| `notification_event_types_distribution` | Gauge | `event_type` | Current distribution of processed event types. |
| `notification_processing_errors_total` | Counter | `error_type` | Processing errors by type. |
| `notification_deserialization_errors_total` | Counter | – | Deserialization/parsing errors. |
| `notification_handler_errors_total` | Counter | – | Handler logic errors. |
| `notification_notifications_sent_total` | Counter | `channel`, `status` | Notifications sent by channel and status (`success`/`failed`). |
| `notification_notifications_failed_total` | Counter | `channel`, `reason` | Failed notification sends. |
| `notification_slack_api_latency_seconds` | Histogram | – | Slack API latency in seconds. |

### 7.2 Prometheus‑native Interpretation & Queries

**Backlog and throughput**

```promql
# Messages consumed per topic
sum(rate(notification_messages_consumed_total[5m])) by (topic)

# Consumer lag
notification_kafka_consumer_lag_seconds
```

**Processing success vs failure**

```promql
# Processing failure rate
sum(rate(notification_messages_failed_total[5m]))
 /
 sum(rate(notification_messages_consumed_total[5m]))
```

**Notification delivery health**

```promql
# Slack notification success rate
(sum(rate(notification_notifications_sent_total{channel="slack", status="success"}[5m]))
 /
 sum(rate(notification_notifications_sent_total{channel="slack"}[5m]))) * 100

# Slack API latency
histogram_quantile(0.95,
  rate(notification_slack_api_latency_seconds_bucket[5m])
)
```

---

## 8. Metrics Aggregator (Synthesized Metrics)

**Files**
- Implementation: `services/metrics-generator/aggregator.py`

The aggregator periodically calls each service’s `/metrics` endpoint, computes **high‑level aggregates**, and can export a small set of synthesized metrics in Prometheus text format.

### 8.1 Exported Metrics

From `export_prometheus_format()` in `aggregator.py`:

| Metric | Conceptual Type | Labels | Description |
|--------|------------------|--------|-------------|
| `service_uptime_seconds` | Gauge | `service` | Uptime of each service, as observed by the aggregator. |
| `service_requests_total` | Counter | `service` | Total requests seen per service (aggregated). |
| `service_errors_total` | Counter | `service` | Total failed requests per service. |
| `service_error_rate_percent` | Gauge | `service` | Error rate percentage per service. |
| `service_latency_ms` | Gauge | `service` | Average latency in milliseconds per service. |
| `service_p95_latency_ms` | Gauge | `service` | Approximate p95 latency per service. |

> These metrics are **derived** from raw service metrics; they provide a simplified, SRE‑style view of the system.

### 8.2 Example Queries

```promql
# Global error rate by service
service_error_rate_percent

# Compare p95 latency across services
service_p95_latency_ms
```

---

## 9. Putting It Together – Golden Signals Dashboards

This section groups metrics across services into typical **Golden Signals**: Latency, Traffic, Errors, and Saturation.

### 9.1 Latency

Use histogram‑based percentiles for user‑facing operations:

```promql
# p95 latency – API Gateway
histogram_quantile(0.95,
  sum by (route, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# p95 latency – User service
histogram_quantile(0.95,
  sum by (endpoint, le) (rate(user_request_duration_seconds_bucket[5m]))
)

# p95 latency – Product list
histogram_quantile(0.95,
  sum by (category, le) (rate(product_list_time_seconds_bucket[5m]))
)
```

### 9.2 Traffic

```promql
# Overall request volume per service (using gateway labels)
sum by (route) (rate(http_requests_total[5m]))

# Orders created per second
rate(orders_created_total[5m])

# Notifications sent per channel
sum(rate(notification_notifications_sent_total[5m])) by (channel)
```

### 9.3 Errors

```promql
# Gateway HTTP error percentage
(sum(rate(http_requests_total{status=~"5.."}[5m]))
 /
 sum(rate(http_requests_total[5m]))) * 100

# User authentication failures by reason
sum(rate(user_auth_failures_total[5m])) by (reason)

# Product service errors
sum(rate(product_errors_total[5m])) by (endpoint)

# Order service errors
sum(rate(order_errors_total[5m])) by (endpoint)
```

### 9.4 Saturation & Capacity

```promql
# DB connection pool saturation (product service)
product_db_connection_pool_size

# Kafka consumer lag (notification worker)
notification_kafka_consumer_lag_seconds

# Low stock products (inventory pressure)
low_stock_products_count
```

---

## 10. Next Steps & Extensions

- **Alerting rules** – use the queries above to build Alertmanager rules (e.g., high error rate, latency SLO breaches, consumer lag, chaos impact).
- **Grafana dashboards** – group charts by:
  - API Gateway (edge metrics)
  - Per‑service detailed dashboards (user, product, order, chaos, notifications)
  - Business KPIs (orders created/completed, inventory health, notification success rates)
- **Tracing integration** – many of these metrics map directly to spans if you add OpenTelemetry later.

This guide should give you a complete, Prometheus‑native mental model for every metric emitted by CloudCartOps. If you add new metrics, follow the same structure (name, type, labels, description, and example queries) and update this file accordingly.

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
**Last Updated**: December 29, 2025