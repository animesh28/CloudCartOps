from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

# Create a custom registry for this service
registry = CollectorRegistry()

# Product Service Prometheus Metrics

# HTTP Request Metrics
http_requests_total = Counter(
    'product_http_requests_total',
    'Total HTTP requests to product service',
    labelnames=['method', 'endpoint', 'status'],
    registry=registry
)

request_duration_seconds = Histogram(
    'product_request_duration_seconds',
    'HTTP request duration in seconds',
    labelnames=['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    registry=registry
)

# Product-specific Metrics
product_list_time = Histogram(
    'product_list_time_seconds',
    'Time to fetch product list',
    labelnames=['category'],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5),
    registry=registry
)

product_search_time = Histogram(
    'product_search_time_seconds',
    'Time to search products',
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5),
    registry=registry
)

product_views_total = Counter(
    'product_views_total',
    'Total product page views',
    labelnames=['product_id', 'category'],
    registry=registry
)

product_stock_updates = Counter(
    'product_stock_updates_total',
    'Total product stock updates',
    labelnames=['product_id', 'reason'],
    registry=registry
)

inventory_alerts_total = Counter(
    'inventory_alerts_total',
    'Total low inventory alerts triggered',
    labelnames=['product_id', 'severity'],
    registry=registry
)

# Database Metrics
db_query_duration_seconds = Histogram(
    'product_db_query_duration_seconds',
    'Database query duration',
    labelnames=['query_type'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2),
    registry=registry
)

db_connection_pool_size = Gauge(
    'product_db_connection_pool_size',
    'Current database connection pool size',
    registry=registry
)

# Product Inventory Gauges
products_by_category = Gauge(
    'products_count_by_category',
    'Number of products in each category',
    labelnames=['category'],
    registry=registry
)

product_average_price = Gauge(
    'product_average_price_dollars',
    'Average product price by category',
    labelnames=['category'],
    registry=registry
)

low_stock_products_count = Gauge(
    'low_stock_products_count',
    'Number of products with low stock (< 10)',
    registry=registry
)

# Kafka Metrics
kafka_events_published_total = Counter(
    'product_kafka_events_published_total',
    'Total Kafka events published',
    labelnames=['event_type', 'status'],
    registry=registry
)

kafka_publish_duration_seconds = Histogram(
    'product_kafka_publish_duration_seconds',
    'Time to publish Kafka events',
    labelnames=['event_type'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1),
    registry=registry
)

# Error tracking
errors_total = Counter(
    'product_errors_total',
    'Total errors by type',
    labelnames=['error_type', 'endpoint'],
    registry=registry
)

def get_metrics():
    """Generate Prometheus metrics in text format"""
    return generate_latest(registry)

def get_content_type():
    """Return the content type for Prometheus metrics"""
    return CONTENT_TYPE_LATEST
