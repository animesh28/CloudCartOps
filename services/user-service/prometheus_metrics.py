from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

# Create a custom registry for this service
registry = CollectorRegistry()

# User Service Prometheus Metrics

# HTTP Request Metrics
http_requests_total = Counter(
    'user_http_requests_total',
    'Total HTTP requests to user service',
    labelnames=['method', 'endpoint', 'status'],
    registry=registry
)

request_duration_seconds = Histogram(
    'user_request_duration_seconds',
    'HTTP request duration in seconds',
    labelnames=['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    registry=registry
)

# User-specific Metrics
user_registrations_total = Counter(
    'user_registrations_total',
    'Total number of user registrations',
    labelnames=['status'],
    registry=registry
)

user_logins_total = Counter(
    'user_logins_total',
    'Total number of user login attempts',
    labelnames=['success'],
    registry=registry
)

password_hashing_duration_seconds = Histogram(
    'password_hashing_duration_seconds',
    'Time taken to hash passwords',
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2),
    registry=registry
)

password_validation_duration_seconds = Histogram(
    'password_validation_duration_seconds',
    'Time taken to validate passwords',
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1),
    registry=registry
)

user_update_duration_seconds = Histogram(
    'user_update_duration_seconds',
    'Time taken to update user information',
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5),
    registry=registry
)

# Database Metrics
db_query_duration_seconds = Histogram(
    'user_db_query_duration_seconds',
    'Database query duration',
    labelnames=['query_type'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2),
    registry=registry
)

db_connection_errors_total = Counter(
    'user_db_connection_errors_total',
    'Total database connection errors',
    registry=registry
)

# User Statistics Gauges
total_users_count = Gauge(
    'total_users_count',
    'Total number of registered users',
    registry=registry
)

active_users_count = Gauge(
    'active_users_count',
    'Number of active users',
    registry=registry
)

admin_users_count = Gauge(
    'admin_users_count',
    'Number of admin users',
    registry=registry
)

# Authentication Metrics
auth_failures_total = Counter(
    'user_auth_failures_total',
    'Total authentication failures',
    labelnames=['reason'],
    registry=registry
)

auth_success_total = Counter(
    'user_auth_success_total',
    'Total successful authentications',
    registry=registry
)

# Kafka Metrics
kafka_events_published_total = Counter(
    'user_kafka_events_published_total',
    'Total Kafka events published',
    labelnames=['event_type', 'status'],
    registry=registry
)

kafka_publish_duration_seconds = Histogram(
    'user_kafka_publish_duration_seconds',
    'Time to publish Kafka events',
    labelnames=['event_type'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1),
    registry=registry
)

# Error tracking
errors_total = Counter(
    'user_errors_total',
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
