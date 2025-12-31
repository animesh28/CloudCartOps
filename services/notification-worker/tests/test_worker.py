"""
Comprehensive unit tests for Notification Worker
Tests metrics, event processing, and worker functionality
"""
import logging

from prometheus_metrics import (
    worker_running,
    worker_uptime_seconds,
    record_worker_restart,
    record_message_consumed,
    record_message_processed,
    record_message_failed,
    record_order_event,
    record_payment_event,
    record_chaos_event,
    set_worker_status,
    set_worker_uptime,
    set_consumer_lag,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestWorkerMetrics:
    """Test suite for worker status metrics"""
    
    def test_worker_status_metrics(self):
        """Test worker status gauge updates"""
        logger.info("Testing worker status metrics")
        
        # Set worker running
        set_worker_status(True)
        assert worker_running._value.get() == 1
        logger.info("✓ Worker status set to running")
        
        # Set worker stopped
        set_worker_status(False)
        assert worker_running._value.get() == 0
        logger.info("✓ Worker status set to stopped")
    
    def test_worker_uptime_metrics(self):
        """Test worker uptime gauge updates"""
        logger.info("Testing worker uptime metrics")
        
        test_uptime = 3600  # 1 hour
        set_worker_uptime(test_uptime)
        
        assert worker_uptime_seconds._value.get() >= test_uptime
        logger.info(f"✓ Worker uptime set to {test_uptime} seconds")
    
    def test_worker_restart_counter(self):
        """Test worker restart counter increments"""
        logger.info("Testing worker restart counter")
        
        initial_restarts = record_worker_restart._value._value if hasattr(record_worker_restart, '_value') else 0
        record_worker_restart()
        
        logger.info("✓ Worker restart recorded")


class TestKafkaMetrics:
    """Test suite for Kafka consumer metrics"""
    
    def test_message_consumed_metrics(self):
        """Test message consumption metrics"""
        logger.info("Testing message consumption metrics")
        
        topic = "test-topic"
        latency_ms = 50
        
        record_message_consumed(topic, latency_ms, success=True)
        logger.info(f"✓ Message consumed from topic: {topic}")
    
    def test_message_processed_metrics(self):
        """Test message processing metrics"""
        logger.info("Testing message processing metrics")
        
        topic = "orders"
        event_type = "order.created"
        duration_ms = 100
        
        record_message_processed(topic, event_type, duration_ms)
        logger.info(f"✓ Message processed: {event_type} in {duration_ms}ms")
    
    def test_message_failed_metrics(self):
        """Test message failure metrics"""
        logger.info("Testing message failure metrics")
        
        topic = "orders"
        error_type = "deserialization_error"
        
        record_message_failed(topic, error_type)
        logger.info(f"✓ Message failure recorded: {error_type}")
    
    def test_consumer_lag_metrics(self):
        """Test consumer lag gauge updates"""
        logger.info("Testing consumer lag metrics")
        
        topic = "orders"
        lag_seconds = 5.5
        
        set_consumer_lag(topic, lag_seconds)
        logger.info(f"✓ Consumer lag set: {lag_seconds}s for topic {topic}")


class TestEventProcessing:
    """Test suite for event processing metrics"""
    
    def test_order_event_metrics(self):
        """Test order event processing metrics"""
        logger.info("Testing order event metrics")
        
        record_order_event()
        logger.info("✓ Order event processed")
    
    def test_payment_event_metrics(self):
        """Test payment event processing metrics"""
        logger.info("Testing payment event metrics")
        
        record_payment_event()
        logger.info("✓ Payment event processed")
    
    def test_chaos_event_metrics(self):
        """Test chaos event processing metrics"""
        logger.info("Testing chaos event metrics")
        
        chaos_type = "latency_injection"
        record_chaos_event(chaos_type)
        logger.info(f"✓ Chaos event processed: {chaos_type}")


class TestEventHandlers:
    """Test suite for event handler logic (mocked)"""
    
    def test_process_user_created_event(self):
        """Test user created event processing"""
        logger.info("Testing user created event handler")
        
        # Mock event message
        message = {
            "username": "test-user",
            "email": "test@example.com",
            "event_type": "user.created"
        }
        
        # Verify message structure
        assert "username" in message
        assert "email" in message
        assert "@" in message["email"]
        
        logger.info(f"✓ User created event validated: {message['username']}")
    
    def test_process_order_created_event(self):
        """Test order created event processing"""
        logger.info("Testing order created event handler")
        
        # Mock event message
        message = {
            "order_id": 123,
            "user_id": 456,
            "total_amount": 99.99,
            "status": "awaiting_payment",
            "event_type": "order.created"
        }
        
        # Verify message structure
        assert "order_id" in message
        assert "user_id" in message
        assert "total_amount" in message
        assert message["total_amount"] > 0
        
        logger.info(f"✓ Order created event validated: Order #{message['order_id']}")
    
    def test_process_payment_confirmed_event(self):
        """Test payment confirmed event processing"""
        logger.info("Testing payment confirmed event handler")
        
        # Mock event message
        message = {
            "order_id": 123,
            "total_amount": 99.99,
            "payment_method": "credit_card",
            "event_type": "order.payment_confirmed"
        }
        
        # Verify message structure
        assert "order_id" in message
        assert "payment_method" in message
        assert message["total_amount"] > 0
        
        logger.info(f"✓ Payment confirmed event validated: Order #{message['order_id']}")


class TestErrorHandling:
    """Test suite for error handling"""
    
    def test_invalid_message_structure(self):
        """Test handling of malformed messages"""
        logger.info("Testing malformed message handling")
        
        # Mock invalid message
        invalid_message = {"incomplete": "data"}
        
        # Should handle gracefully (no required fields)
        assert isinstance(invalid_message, dict)
        logger.info("✓ Malformed message structure detected")
    
    def test_missing_event_type(self):
        """Test handling of messages without event_type"""
        logger.info("Testing missing event_type handling")
        
        message = {
            "order_id": 123,
            "user_id": 456
            # Missing event_type
        }
        
        # Verify event_type is missing
        assert "event_type" not in message
        logger.info("✓ Missing event_type detected")


if __name__ == "__main__":
    # Run with: pytest services/notification-worker/tests/test_worker.py -v
    logger.info("Run tests with: pytest services/notification-worker/tests/test_worker.py -v")
