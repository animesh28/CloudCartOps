"""
Comprehensive unit tests for Chaos Service
Tests chaos injection, configuration, and metrics
"""
import logging

from fastapi.testclient import TestClient
from main import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = TestClient(app)


class TestChaosServiceHealth:
    """Test suite for chaos service health and status"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        logger.info("Testing chaos service health endpoint")
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("service") == "chaos-service"
        
        logger.info("✓ Chaos service health check passed")


class TestChaosConfiguration:
    """Test suite for chaos configuration endpoints"""
    
    def test_get_chaos_status(self):
        """Test getting current chaos configuration"""
        logger.info("Testing get chaos status")
        
        response = client.get("/chaos/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "enabled" in data
        assert isinstance(data["enabled"], bool)
        
        logger.info(f"✓ Chaos status retrieved: enabled={data.get('enabled')}")
    
    def test_enable_chaos(self):
        """Test enabling chaos injection"""
        logger.info("Testing enable chaos")
        
        response = client.post("/chaos/enable")
        
        assert response.status_code in (200, 201)
        data = response.json()
        
        # Verify chaos was enabled
        if "enabled" in data:
            assert data["enabled"] is True
        
        logger.info("✓ Chaos injection enabled")
    
    def test_disable_chaos(self):
        """Test disabling chaos injection"""
        logger.info("Testing disable chaos")
        
        response = client.post("/chaos/disable")
        
        assert response.status_code in (200, 201)
        data = response.json()
        
        # Verify chaos was disabled
        if "enabled" in data:
            assert data["enabled"] is False
        
        logger.info("✓ Chaos injection disabled")


class TestChaosInjectionTypes:
    """Test suite for different chaos injection types"""
    
    def test_inject_latency(self):
        """Test latency injection configuration"""
        logger.info("Testing latency injection")
        
        payload = {
            "type": "latency",
            "duration_ms": 1000,
            "probability": 0.5
        }
        
        response = client.post("/chaos/inject", json=payload)
        
        # Response varies by implementation
        assert response.status_code in (200, 201, 204)
        logger.info("✓ Latency injection configured")
    
    def test_inject_error(self):
        """Test error injection configuration"""
        logger.info("Testing error injection")
        
        payload = {
            "type": "error",
            "error_code": 500,
            "probability": 0.3
        }
        
        response = client.post("/chaos/inject", json=payload)
        
        assert response.status_code in (200, 201, 204)
        logger.info("✓ Error injection configured")
    
    def test_inject_timeout(self):
        """Test timeout injection configuration"""
        logger.info("Testing timeout injection")
        
        payload = {
            "type": "timeout",
            "probability": 0.2
        }
        
        response = client.post("/chaos/inject", json=payload)
        
        assert response.status_code in (200, 201, 204)
        logger.info("✓ Timeout injection configured")


class TestChaosMetrics:
    """Test suite for chaos service metrics"""
    
    def test_metrics_endpoint(self):
        """Test Prometheus metrics endpoint"""
        logger.info("Testing chaos metrics endpoint")
        
        response = client.get("/metrics")
        
        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")
        
        # Verify metrics contain chaos-specific data
        metrics_text = response.text
        assert "chaos" in metrics_text.lower()
        
        logger.info("✓ Chaos metrics endpoint accessible")


class TestChaosValidation:
    """Test suite for chaos input validation"""
    
    def test_invalid_injection_type(self):
        """Test that invalid injection types are rejected"""
        logger.info("Testing invalid injection type rejection")
        
        payload = {
            "type": "invalid_type",
            "probability": 0.5
        }
        
        response = client.post("/chaos/inject", json=payload)
        
        # Should reject invalid types (400 or 422)
        assert response.status_code in (400, 422)
        logger.info("✓ Invalid injection type correctly rejected")
    
    def test_invalid_probability(self):
        """Test that invalid probability values are rejected"""
        logger.info("Testing invalid probability rejection")
        
        payload = {
            "type": "latency",
            "probability": 1.5  # Invalid: should be between 0 and 1
        }
        
        response = client.post("/chaos/inject", json=payload)
        
        # Should reject invalid probability
        assert response.status_code in (400, 422)
        logger.info("✓ Invalid probability correctly rejected")


if __name__ == "__main__":
    # Run with: pytest services/chaos-service/tests/test_chaos.py -v
    logger.info("Run tests with: pytest services/chaos-service/tests/test_chaos.py -v")
