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
      
       response = client.get("/chaos/config")
      
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
       """Test latency injection"""
       logger.info("Testing latency injection")
      
       response = client.post("/chaos/inject/latency?min_ms=100&max_ms=500")
      
       assert response.status_code == 200
       data = response.json()
      
       # Verify response contains chaos info
       assert "chaos_type" in data or "message" in data
       logger.info("✓ Latency injection executed")
  
   def test_inject_error(self):
       """Test error injection"""
       logger.info("Testing error injection")
      
       response = client.post("/chaos/inject/error?error_code=503&message=TestError")
      
       # This endpoint actually raises an error, so expect the error code
       assert response.status_code in (500, 503)
       logger.info("✓ Error injection executed (correctly returned error)")
  
   def test_inject_random(self):
       """Test random chaos injection"""
       logger.info("Testing random chaos injection")
      
       response = client.post("/chaos/inject/random")
      
       # Random chaos might succeed or raise error, both are valid
       assert response.status_code in (200, 400, 500, 502, 503, 504)
       logger.info("✓ Random chaos injection executed")


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
   """Test suite for chaos endpoint tests"""
  
   def test_slow_endpoint(self):
       """Test the intentionally slow endpoint"""
       logger.info("Testing slow endpoint")
      
       response = client.get("/chaos/test/slow")
      
       assert response.status_code == 200
       data = response.json()
       assert "delay_ms" in data
       logger.info("✓ Slow endpoint test passed")
  
   def test_error_endpoint(self):
       """Test the intentionally failing endpoint"""
       logger.info("Testing error endpoint")
      
       response = client.get("/chaos/test/error")
      
       # This endpoint always returns 500
       assert response.status_code == 500
       logger.info("✓ Error endpoint correctly returns 500")


if __name__ == "__main__":
   # Run with: pytest services/chaos-service/tests/test_chaos.py -v
   logger.info("Run tests with: pytest services/chaos-service/tests/test_chaos.py -v")