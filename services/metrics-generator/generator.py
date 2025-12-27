import requests
import random
import time
import os
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

API_GATEWAY_URL = os.getenv('API_GATEWAY_URL', 'http://api-gateway:3000')
INTERVAL_SECONDS = int(os.getenv('INTERVAL_SECONDS', 5))

# Sample product IDs
PRODUCT_IDS = list(range(1, 11))

# Sample endpoints to hit
ENDPOINTS = [
    {'method': 'GET', 'path': '/api/products', 'weight': 30},
    {'method': 'GET', 'path': '/api/products/1', 'weight': 20},
    {'method': 'GET', 'path': '/api/products/category/Electronics', 'weight': 15},
    {'method': 'GET', 'path': '/health', 'weight': 35},
]

def generate_traffic():
    """Generate random traffic to API Gateway"""
    
    # Select endpoint based on weights
    total_weight = sum(e['weight'] for e in ENDPOINTS)
    rand = random.randint(1, total_weight)
    
    cumulative = 0
    selected_endpoint = None
    for endpoint in ENDPOINTS:
        cumulative += endpoint['weight']
        if rand <= cumulative:
            selected_endpoint = endpoint
            break
    
    if not selected_endpoint:
        selected_endpoint = ENDPOINTS[0]
    
    url = f"{API_GATEWAY_URL}{selected_endpoint['path']}"
    method = selected_endpoint['method']
    
    try:
        start_time = time.time()
        
        if method == 'GET':
            response = requests.get(url, timeout=10)
        elif method == 'POST':
            response = requests.post(url, json={}, timeout=10)
        else:
            response = requests.request(method, url, timeout=10)
        
        duration_ms = (time.time() - start_time) * 1000
        
        logger.info(
            f"📊 {method} {selected_endpoint['path']} - "
            f"Status: {response.status_code} - "
            f"Duration: {duration_ms:.2f}ms"
        )
        
        return {
            'success': response.status_code < 400,
            'status_code': response.status_code,
            'duration_ms': duration_ms
        }
        
    except requests.exceptions.Timeout:
        logger.error(f"⏱️  TIMEOUT: {method} {selected_endpoint['path']}")
        return {'success': False, 'status_code': 0, 'error': 'timeout'}
        
    except requests.exceptions.ConnectionError:
        logger.error(f"🔌 CONNECTION ERROR: {method} {selected_endpoint['path']}")
        return {'success': False, 'status_code': 0, 'error': 'connection_error'}
        
    except Exception as e:
        logger.error(f"❌ ERROR: {method} {selected_endpoint['path']} - {e}")
        return {'success': False, 'status_code': 0, 'error': str(e)}

def generate_burst_traffic():
    """Generate a burst of traffic"""
    logger.info("🔥 Generating traffic burst...")
    
    burst_size = random.randint(10, 30)
    for _ in range(burst_size):
        generate_traffic()
        time.sleep(0.1)  # Small delay between requests
    
    logger.info(f"✅ Burst complete: {burst_size} requests")

def generate_error_traffic():
    """Intentionally generate some errors"""
    logger.info("💥 Generating error traffic...")
    
    # Try to access non-existent resources
    error_endpoints = [
        f"{API_GATEWAY_URL}/api/products/99999",
        f"{API_GATEWAY_URL}/api/users/99999",
        f"{API_GATEWAY_URL}/api/invalid",
    ]
    
    for endpoint in error_endpoints:
        try:
            response = requests.get(endpoint, timeout=5)
            logger.info(f"Error endpoint: {endpoint} - Status: {response.status_code}")
        except Exception as e:
            logger.error(f"Error endpoint failed: {endpoint} - {e}")

def main():
    logger.info("🚀 Starting Metrics Generator...")
    logger.info(f"Target API Gateway: {API_GATEWAY_URL}")
    logger.info(f"Interval: {INTERVAL_SECONDS} seconds")
    
    # Wait for API Gateway to be ready
    logger.info("Waiting for API Gateway to be ready...")
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            response = requests.get(f"{API_GATEWAY_URL}/health", timeout=5)
            if response.status_code == 200:
                logger.info("✅ API Gateway is ready!")
                break
        except Exception as e:
            logger.warning(f"Waiting for API Gateway... ({retry_count + 1}/{max_retries})")
            time.sleep(2)
            retry_count += 1
    
    if retry_count >= max_retries:
        logger.error("❌ Failed to connect to API Gateway. Exiting.")
        return
    
    # Metrics tracking
    total_requests = 0
    successful_requests = 0
    failed_requests = 0
    
    try:
        while True:
            # Normal traffic
            for _ in range(random.randint(1, 3)):
                result = generate_traffic()
                total_requests += 1
                
                if result.get('success'):
                    successful_requests += 1
                else:
                    failed_requests += 1
                
                time.sleep(random.uniform(0.5, 2))
            
            # Occasionally generate burst traffic
            if random.random() < 0.1:  # 10% chance
                generate_burst_traffic()
            
            # Occasionally generate error traffic
            if random.random() < 0.05:  # 5% chance
                generate_error_traffic()
            
            # Log statistics
            if total_requests % 20 == 0:
                success_rate = (successful_requests / total_requests * 100) if total_requests > 0 else 0
                logger.info(f"\n{'='*60}")
                logger.info(f"📈 STATISTICS")
                logger.info(f"Total Requests: {total_requests}")
                logger.info(f"Successful: {successful_requests}")
                logger.info(f"Failed: {failed_requests}")
                logger.info(f"Success Rate: {success_rate:.2f}%")
                logger.info(f"{'='*60}\n")
            
            time.sleep(INTERVAL_SECONDS)
            
    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping Metrics Generator...")
        logger.info(f"Final Stats - Total: {total_requests}, Success: {successful_requests}, Failed: {failed_requests}")

if __name__ == "__main__":
    main()
