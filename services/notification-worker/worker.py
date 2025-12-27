from kafka import KafkaConsumer
import json
import os
import logging
from datetime import datetime
from prometheus_client import start_http_server
import prometheus_metrics
import threading

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092').split(',')
KAFKA_GROUP_ID = os.getenv('KAFKA_GROUP_ID', 'notification-worker-group')

TOPICS = [
    'user.created',
    'order.created',
    'order.payment_confirmed',
    'order.status_changed',
    'stock.low',
    'api.rate_limited',
    'chaos.injected'
]

def process_user_created(message):
    """Process user created event"""
    logger.info(f"📧 NEW USER REGISTERED")
    logger.info(f"   Username: {message.get('username')}")
    logger.info(f"   Email: {message.get('email')}")
    logger.info(f"   ✉️  Welcome email sent to {message.get('email')}")

def process_order_created(message):
    """Process order created event"""
    logger.info(f"🛒 ORDER CREATED")
    logger.info(f"   Order ID: #{message.get('order_id')}")
    logger.info(f"   User ID: {message.get('user_id')}")
    logger.info(f"   Total: ${message.get('total_amount')}")
    logger.info(f"   Items: {message.get('items', 'N/A')}")
    logger.info(f"   Status: awaiting_payment")
    logger.info(f"   📧 Order confirmation sent to user")
    logger.info(f"   💳 Payment instructions sent")
    logger.info(f"   ⏰ Awaiting payment within 24 hours")

def process_order_payment_confirmed(message):
    """Process order payment confirmed event"""
    logger.info(f"✅ PAYMENT CONFIRMED")
    logger.info(f"   Order ID: #{message.get('order_id')}")
    logger.info(f"   User ID: {message.get('user_id')}")
    logger.info(f"   Amount: ${message.get('total_amount')}")
    logger.info(f"   Items: {message.get('item_count', 'N/A')}")
    logger.info(f"   Payment Method: {message.get('payment_method')}")
    logger.info(f"   Status: awaiting_payment → confirmed")
    logger.info(f"   📊 Stock reduced for all items in order")
    logger.info(f"   📦 Order is now CONFIRMED and ready for fulfillment")
    logger.info(f"   📧 Payment confirmation sent to user")
    logger.info(f"   📧 Fulfillment notification sent to warehouse team")

def process_order_status_changed(message):
    """Process order status change event"""
    old_status = message.get('old_status')
    new_status = message.get('new_status')
    order_id = message.get('order_id')
    user_id = message.get('user_id')
    total_amount = message.get('total_amount')
    item_count = message.get('item_count', 'N/A')
    custom_message = message.get('message', 'Order status updated')
    
    status_emoji = {
        'awaiting_payment': '⏳',
        'confirmed': '✅',
        'shipped': '📦',
        'delivered': '🎉',
        'cancelled': '❌',
        'returned': '↩️'
    }
    
    emoji = status_emoji.get(new_status, '📋')
    logger.info(f"{emoji} ORDER STATUS UPDATED")
    logger.info(f"   Order ID: #{order_id}")
    logger.info(f"   User ID: {user_id}")
    logger.info(f"   Status: {old_status.upper()} → {new_status.upper()}")
    logger.info(f"   Total: ${total_amount}")
    logger.info(f"   Items: {item_count}")
    logger.info(f"   Message: {custom_message}")
    
    # Log notification actions based on status
    if new_status == 'shipped':
        logger.info(f"   📬 SHIPPING NOTIFICATION: Order #{order_id} is on the way to user #{user_id}")
        logger.info(f"   📧 Email sent: Tracking information provided")
    elif new_status == 'delivered':
        logger.info(f"   🎉 DELIVERY CONFIRMATION: Order #{order_id} delivered to user #{user_id}")
        logger.info(f"   📧 Email sent: Delivery confirmation")
        logger.info(f"   📱 SMS sent: Delivery complete")
    elif new_status == 'confirmed':
        logger.info(f"   ✅ ORDER CONFIRMATION: Order #{order_id} confirmed for user #{user_id}")
        logger.info(f"   📧 Email sent: Order confirmed, ready for fulfillment")
        logger.info(f"   💰 Amount: ${total_amount}")
    elif new_status == 'cancelled':
        logger.warning(f"   ⚠️  ORDER CANCELLATION: Order #{order_id} cancelled")
        logger.warning(f"   📧 Email sent: Cancellation confirmation and refund details")
        logger.warning(f"   💸 Refund: ${total_amount} initiated")
    elif new_status == 'returned':
        logger.info(f"   ↩️  RETURN PROCESSED: Order #{order_id} returned by user #{user_id}")
        logger.info(f"   📧 Email sent: Return confirmation")
    else:
        logger.info(f"   📧 Notification sent for status change to {new_status}")

def process_stock_low(message):
    """Process low stock event"""
    logger.warning(f"📉 LOW STOCK ALERT!")
    logger.warning(f"   Product: {message.get('product_name')} (ID: {message.get('product_id')})")
    logger.warning(f"   Remaining stock: {message.get('stock')}")
    logger.warning(f"   🚨 Inventory alert sent to management team")

def process_rate_limited(message):
    """Process rate limit event"""
    logger.warning(f"🚨 NOTIFICATION: Rate limit triggered")
    logger.warning(f"   IP: {message.get('ip')}, Path: {message.get('path')}")
    logger.warning(f"   Alert would be sent to security team")

def process_chaos_injected(message):
    """Process chaos injection event"""
    logger.info(f"🔥 NOTIFICATION: Chaos event detected")
    logger.info(f"   Type: {message.get('chaos_type')}")
    logger.info(f"   Details: {message.get('details')}")

# Event handlers mapping
EVENT_HANDLERS = {
    'user.created': process_user_created,
    'order.created': process_order_created,
    'order.payment_confirmed': process_order_payment_confirmed,
    'order.status_changed': process_order_status_changed,
    'stock.low': process_stock_low,
    'api.rate_limited': process_rate_limited,
    'chaos.injected': process_chaos_injected
}

def main():
    logger.info("Starting Notification Worker...")
    logger.info(f"Kafka Brokers: {KAFKA_BOOTSTRAP_SERVERS}")
    logger.info(f"Subscribed Topics: {TOPICS}")

    # Start Prometheus metrics HTTP server on port 8005
    metrics_port = int(os.getenv('METRICS_PORT', 8005))
    start_http_server(metrics_port, registry=prometheus_metrics.registry)
    logger.info(f"✅ Prometheus metrics server started on port {metrics_port}")
    
    # Set worker as running
    prometheus_metrics.worker_running.set(1)
    start_time = datetime.now()

    try:
        consumer = KafkaConsumer(
            *TOPICS,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=KAFKA_GROUP_ID,
            auto_offset_reset='earliest',
            enable_auto_commit=True,
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )

        logger.info("✅ Notification Worker started successfully")
        logger.info("Waiting for events...")

        for message in consumer:
            try:
                topic = message.topic
                event_data = message.value

                # Update uptime
                uptime = (datetime.now() - start_time).total_seconds()
                prometheus_metrics.worker_uptime_seconds.set(uptime)

                # Record message consumed
                prometheus_metrics.messages_consumed_total.labels(topic=topic).inc()

                logger.info(f"\n{'='*60}")
                logger.info(f"Received event from topic: {topic}")
                logger.info(f"Event data: {json.dumps(event_data, indent=2)}")
                logger.info(f"{'='*60}")

                # Process event with appropriate handler
                process_start = datetime.now()
                handler = EVENT_HANDLERS.get(topic)
                if handler:
                    handler(event_data)
                    # Record successful processing
                    process_duration = (datetime.now() - process_start).total_seconds()
                    prometheus_metrics.message_processing_duration_seconds.labels(
                        topic=topic
                    ).observe(process_duration)
                    prometheus_metrics.messages_processed_total.labels(
                        topic=topic, event_type=topic
                    ).inc()
                else:
                    logger.warning(f"No handler found for topic: {topic}")
                    prometheus_metrics.messages_failed_total.labels(
                        topic=topic, error_type='no_handler'
                    ).inc()

                # Simulate notification sent
                logger.info(f"✉️  Notification processed successfully for {topic}\n")

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                prometheus_metrics.messages_failed_total.labels(
                    topic=topic, error_type=type(e).__name__
                ).inc()
                continue

    except KeyboardInterrupt:
        logger.info("Shutting down Notification Worker...")
        prometheus_metrics.worker_running.set(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        prometheus_metrics.worker_running.set(0)
        prometheus_metrics.worker_restarts_total.inc()
        raise

if __name__ == "__main__":
    main()
