from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
import time

# Notification Worker Prometheus Metrics
registry = CollectorRegistry()

# Worker Status Metrics
worker_running = Gauge(
    'notification_worker_running',
    'Is notification worker running (1=yes, 0=no)',
    registry=registry
)

worker_restarts_total = Counter(
    'notification_worker_restarts_total',
    'Total worker restarts',
    registry=registry
)

worker_uptime_seconds = Gauge(
    'notification_worker_uptime_seconds',
    'Worker uptime in seconds',
    registry=registry
)

# Kafka Consumer Metrics
messages_consumed_total = Counter(
    'notification_messages_consumed_total',
    'Total messages consumed from Kafka',
    labelnames=['topic'],
    registry=registry
)

messages_processed_total = Counter(
    'notification_messages_processed_total',
    'Total messages successfully processed',
    labelnames=['topic', 'event_type'],
    registry=registry
)

messages_failed_total = Counter(
    'notification_messages_failed_total',
    'Total messages that failed processing',
    labelnames=['topic', 'error_type'],
    registry=registry
)

message_processing_duration_seconds = Histogram(
    'notification_message_processing_duration_seconds',
    'Message processing duration',
    labelnames=['topic', 'event_type'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 2, 5),
    registry=registry
)

kafka_consumer_lag_seconds = Gauge(
    'notification_kafka_consumer_lag_seconds',
    'Kafka consumer lag in seconds',
    labelnames=['topic'],
    registry=registry
)

# Event Processing Metrics
order_events_processed_total = Counter(
    'notification_order_events_processed_total',
    'Total order events processed',
    registry=registry
)

payment_events_processed_total = Counter(
    'notification_payment_events_processed_total',
    'Total payment events processed',
    registry=registry
)

chaos_events_processed_total = Counter(
    'notification_chaos_events_processed_total',
    'Total chaos events processed',
    labelnames=['chaos_type'],
    registry=registry
)

notification_events_processed_total = Counter(
    'notification_notification_events_processed_total',
    'Total notification events processed',
    registry=registry
)

event_types_distribution = Gauge(
    'notification_event_types_distribution',
    'Distribution of event types processed',
    labelnames=['event_type'],
    registry=registry
)

# Error Metrics
processing_errors_total = Counter(
    'notification_processing_errors_total',
    'Total processing errors',
    labelnames=['error_type'],
    registry=registry
)

deserialization_errors_total = Counter(
    'notification_deserialization_errors_total',
    'Total deserialization errors',
    registry=registry
)

handler_errors_total = Counter(
    'notification_handler_errors_total',
    'Total handler execution errors',
    registry=registry
)

# Notification Delivery Metrics
notifications_sent_total = Counter(
    'notification_notifications_sent_total',
    'Total notifications sent',
    labelnames=['channel', 'status'],
    registry=registry
)

notifications_failed_total = Counter(
    'notification_notifications_failed_total',
    'Total notifications that failed to send',
    labelnames=['channel', 'reason'],
    registry=registry
)

slack_api_latency_seconds = Histogram(
    'notification_slack_api_latency_seconds',
    'Slack API response latency',
    buckets=(0.1, 0.5, 1, 2, 5, 10),
    registry=registry
)

# Helper Functions
def record_message_consumed(topic, latency_ms, success=True):
    """Record consumed message from Kafka"""
    messages_consumed_total.labels(topic=topic).inc()
    if not success:
        messages_failed_total.labels(topic=topic, error_type='processing').inc()

def record_message_processed(topic, event_type, duration_ms):
    """Record successfully processed message"""
    messages_processed_total.labels(topic=topic, event_type=event_type).inc()
    message_processing_duration_seconds.labels(topic=topic, event_type=event_type).observe(duration_ms / 1000)

def record_message_failed(topic, error_type):
    """Record failed message"""
    messages_failed_total.labels(topic=topic, error_type=error_type).inc()
    processing_errors_total.labels(error_type=error_type).inc()

def record_order_event():
    """Record order event processed"""
    order_events_processed_total.inc()
    event_types_distribution.labels(event_type='order').inc()

def record_payment_event():
    """Record payment event processed"""
    payment_events_processed_total.inc()
    event_types_distribution.labels(event_type='payment').inc()

def record_chaos_event(chaos_type):
    """Record chaos event processed"""
    chaos_events_processed_total.labels(chaos_type=chaos_type).inc()
    event_types_distribution.labels(event_type='chaos').inc()

def record_notification_event():
    """Record notification event processed"""
    notification_events_processed_total.inc()
    event_types_distribution.labels(event_type='notification').inc()

def record_deserialization_error():
    """Record deserialization error"""
    deserialization_errors_total.inc()
    processing_errors_total.labels(error_type='deserialization').inc()

def record_handler_error():
    """Record handler execution error"""
    handler_errors_total.inc()
    processing_errors_total.labels(error_type='handler').inc()

def record_notification_sent(channel, success=True, latency=0):
    """Record sent notification"""
    status = 'success' if success else 'failed'
    notifications_sent_total.labels(channel=channel, status=status).inc()
    
    if not success:
        notifications_failed_total.labels(channel=channel, reason='send_failed').inc()
    
    if latency > 0 and channel == 'slack':
        slack_api_latency_seconds.observe(latency / 1000)

def set_worker_status(running):
    """Set worker running status"""
    worker_running.set(1 if running else 0)

def set_worker_uptime(seconds):
    """Set worker uptime"""
    worker_uptime_seconds.set(seconds)

def record_worker_restart():
    """Record worker restart"""
    worker_restarts_total.inc()

def set_consumer_lag(topic, lag_seconds):
    """Set Kafka consumer lag"""
    kafka_consumer_lag_seconds.labels(topic=topic).set(lag_seconds)
