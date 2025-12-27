from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
import time

# Chaos Service Prometheus Metrics
registry = CollectorRegistry()

# HTTP Request Metrics
http_requests_total = Counter(
    'chaos_http_requests_total',
    'Total HTTP requests to chaos service',
    labelnames=['method', 'endpoint', 'status'],
    registry=registry
)

request_duration_seconds = Histogram(
    'chaos_request_duration_seconds',
    'HTTP request duration',
    labelnames=['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10),
    registry=registry
)

# Chaos Injection Metrics
chaos_injections_total = Counter(
    'chaos_injections_total',
    'Total chaos injections triggered',
    labelnames=['injection_type', 'status'],
    registry=registry
)

chaos_enabled_total = Counter(
    'chaos_enabled_total',
    'Total times chaos was enabled',
    registry=registry
)

chaos_disabled_total = Counter(
    'chaos_disabled_total',
    'Total times chaos was disabled',
    registry=registry
)

chaos_config_updates_total = Counter(
    'chaos_config_updates_total',
    'Total chaos configuration updates',
    registry=registry
)

latency_injections_total = Counter(
    'latency_injections_total',
    'Total latency chaos injections',
    registry=registry
)

error_injections_total = Counter(
    'error_injections_total',
    'Total error chaos injections',
    registry=registry
)

timeout_injections_total = Counter(
    'timeout_injections_total',
    'Total timeout chaos injections',
    registry=registry
)

random_chaos_injections_total = Counter(
    'random_chaos_injections_total',
    'Total random chaos injections',
    registry=registry
)

# Kafka Metrics
kafka_messages_published_total = Counter(
    'chaos_kafka_messages_published_total',
    'Total Kafka messages published by chaos service',
    labelnames=['event_type'],
    registry=registry
)

kafka_publish_errors_total = Counter(
    'chaos_kafka_publish_errors_total',
    'Total Kafka publish failures',
    registry=registry
)

kafka_publish_success_rate = Gauge(
    'chaos_kafka_publish_success_rate',
    'Kafka publish success rate (percentage)',
    registry=registry
)

kafka_latency_seconds = Histogram(
    'chaos_kafka_latency_seconds',
    'Kafka publish latency',
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 2, 5),
    registry=registry
)

# Service Health Metrics
uptime_seconds = Gauge(
    'chaos_service_uptime_seconds',
    'Chaos service uptime',
    registry=registry
)

def record_request(method, endpoint, status_code, duration):
    """Record HTTP request"""
    http_requests_total.labels(method=method, endpoint=endpoint, status=status_code).inc()
    request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)

def record_chaos_enabled():
    """Record chaos enabled"""
    chaos_enabled_total.inc()
    chaos_injections_total.labels(injection_type='enable', status='success').inc()

def record_chaos_disabled():
    """Record chaos disabled"""
    chaos_disabled_total.inc()
    chaos_injections_total.labels(injection_type='disable', status='success').inc()

def record_config_update():
    """Record configuration update"""
    chaos_config_updates_total.inc()

def record_latency_injection():
    """Record latency injection"""
    latency_injections_total.inc()
    chaos_injections_total.labels(injection_type='latency', status='success').inc()

def record_error_injection():
    """Record error injection"""
    error_injections_total.inc()
    chaos_injections_total.labels(injection_type='error', status='success').inc()

def record_timeout_injection():
    """Record timeout injection"""
    timeout_injections_total.inc()
    chaos_injections_total.labels(injection_type='timeout', status='success').inc()

def record_random_chaos():
    """Record random chaos injection"""
    random_chaos_injections_total.inc()
    chaos_injections_total.labels(injection_type='random', status='success').inc()

def record_kafka_publish(event_type, success=True, latency=0):
    """Record Kafka publish"""
    kafka_messages_published_total.labels(event_type=event_type).inc()
    
    if not success:
        kafka_publish_errors_total.inc()
    
    if latency > 0:
        kafka_latency_seconds.observe(latency)
    
    total = kafka_messages_published_total._metrics[('chaos_kafka_messages_published_total', ('event_type',))][tuple([event_type])]._value._value if hasattr(kafka_messages_published_total, '_metrics') else 0
    errors = kafka_publish_errors_total._value._value if hasattr(kafka_publish_errors_total, '_value') else 0
    
    if total > 0:
        success_rate = ((total - errors) / total) * 100
        kafka_publish_success_rate.set(success_rate)

def set_uptime(seconds):
    """Set service uptime"""
    uptime_seconds.set(seconds)
