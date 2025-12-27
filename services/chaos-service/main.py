from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import random
import time
import os
from datetime import datetime
from kafka_producer import publish_event
import prometheus_metrics

app = FastAPI(title="Chaos Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHAOS_ENABLED = os.getenv("CHAOS_ENABLED", "true").lower() == "true"

class ChaosConfig(BaseModel):
    error_rate: float = 0.1  # 10% chance
    latency_min_ms: int = 100
    latency_max_ms: int = 3000
    timeout_rate: float = 0.05  # 5% chance

chaos_config = ChaosConfig()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "chaos-service",
        "chaos_enabled": CHAOS_ENABLED,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=prometheus_metrics.get_metrics(),
        media_type=prometheus_metrics.get_content_type()
    )

@app.get("/chaos/config")
def get_chaos_config():
    return {
        "enabled": CHAOS_ENABLED,
        "config": chaos_config.dict()
    }

@app.put("/chaos/config")
def update_chaos_config(config: ChaosConfig):
    global chaos_config
    chaos_config = config
    prometheus_metrics.record_config_update()
    return {"message": "Chaos config updated", "config": chaos_config.dict()}

@app.post("/chaos/inject/latency")
def inject_latency(min_ms: int = 100, max_ms: int = 1000):
    """Inject latency delay"""
    start_time = time.time()
    
    if not CHAOS_ENABLED:
        prometheus_metrics.http_requests_total.labels(
            method='POST', endpoint='/chaos/inject/latency', status='200'
        ).inc()
        return {"message": "Chaos is disabled"}
    
    delay_ms = random.randint(min_ms, max_ms)
    time.sleep(delay_ms / 1000)
    
    # Record metrics
    prometheus_metrics.chaos_injections_total.labels(
        injection_type='latency', status='success'
    ).inc()
    prometheus_metrics.latency_injections_total.inc()
    prometheus_metrics.latency_injection_duration_ms.observe(delay_ms)
    
    publish_event('chaos.injected', {
        'chaos_type': 'latency',
        'details': f'Injected {delay_ms}ms delay',
        'timestamp': datetime.utcnow().isoformat()
    })
    
    duration = time.time() - start_time
    prometheus_metrics.http_requests_total.labels(
        method='POST', endpoint='/chaos/inject/latency', status='200'
    ).inc()
    prometheus_metrics.request_duration_seconds.labels(
        method='POST', endpoint='/chaos/inject/latency'
    ).observe(duration)
    
    return {
        "chaos_type": "latency",
        "delay_ms": delay_ms,
        "message": f"Injected {delay_ms}ms latency"
    }

@app.post("/chaos/inject/error")
def inject_error(error_code: int = 500, message: str = "Chaos-induced error"):
    """Inject an error response"""
    start_time = time.time()
    
    if not CHAOS_ENABLED:
        prometheus_metrics.http_requests_total.labels(
            method='POST', endpoint='/chaos/inject/error', status='200'
        ).inc()
        return {"message": "Chaos is disabled"}
    
    # Record metrics
    prometheus_metrics.chaos_injections_total.labels(
        injection_type='error', status='success'
    ).inc()
    prometheus_metrics.error_injections_total.labels(error_code=str(error_code)).inc()
    
    publish_event('chaos.injected', {
        'chaos_type': 'error',
        'details': f'HTTP {error_code}: {message}',
        'timestamp': datetime.utcnow().isoformat()
    })
    
    duration = time.time() - start_time
    prometheus_metrics.http_requests_total.labels(
        method='POST', endpoint='/chaos/inject/error', status=str(error_code)
    ).inc()
    prometheus_metrics.request_duration_seconds.labels(
        method='POST', endpoint='/chaos/inject/error'
    ).observe(duration)
    
    raise HTTPException(status_code=error_code, detail=message)

@app.post("/chaos/inject/random")
def inject_random_chaos():
    """Inject random chaos based on configuration"""
    if not CHAOS_ENABLED:
        return {"message": "Chaos is disabled"}
    
    rand = random.random()
    
    # Random error
    if rand < chaos_config.error_rate:
        error_codes = [400, 500, 502, 503, 504]
        error_code = random.choice(error_codes)
        
        publish_event('chaos.injected', {
            'chaos_type': 'random_error',
            'details': f'HTTP {error_code}',
            'timestamp': datetime.utcnow().isoformat()
        })
        
        raise HTTPException(
            status_code=error_code,
            detail=f"Random chaos error: {error_code}"
        )
    
    # Random latency
    elif rand < chaos_config.error_rate + 0.2:  # 20% latency
        delay_ms = random.randint(
            chaos_config.latency_min_ms,
            chaos_config.latency_max_ms
        )
        time.sleep(delay_ms / 1000)
        
        publish_event('chaos.injected', {
            'chaos_type': 'random_latency',
            'details': f'{delay_ms}ms delay',
            'timestamp': datetime.utcnow().isoformat()
        })
        
        return {
            "chaos_type": "latency",
            "delay_ms": delay_ms,
            "message": f"Random latency: {delay_ms}ms"
        }
    
    # No chaos
    return {
        "chaos_type": "none",
        "message": "No chaos injected this time"
    }

@app.get("/chaos/test/slow")
def slow_endpoint():
    """Always slow endpoint for testing"""
    delay_ms = random.randint(2000, 5000)
    time.sleep(delay_ms / 1000)
    
    return {
        "message": "This endpoint is intentionally slow",
        "delay_ms": delay_ms
    }

@app.get("/chaos/test/error")
def error_endpoint():
    """Always returns error for testing"""
    publish_event('chaos.injected', {
        'chaos_type': 'test_error',
        'details': 'Intentional test error',
        'timestamp': datetime.utcnow().isoformat()
    })
    
    raise HTTPException(status_code=500, detail="This endpoint always fails")

@app.get("/chaos/test/memory-leak")
def memory_leak_endpoint():
    """Simulate memory leak"""
    # Create a large list to simulate memory consumption
    large_list = [i for i in range(1000000)]
    
    return {
        "message": "Memory leak simulated",
        "items_created": len(large_list)
    }

@app.post("/chaos/enable")
def enable_chaos():
    """Enable chaos injection"""
    global CHAOS_ENABLED
    CHAOS_ENABLED = True
    return {"message": "Chaos enabled", "enabled": CHAOS_ENABLED}

@app.post("/chaos/disable")
def disable_chaos():
    """Disable chaos injection"""
    global CHAOS_ENABLED
    CHAOS_ENABLED = False
    return {"message": "Chaos disabled", "enabled": CHAOS_ENABLED}

@app.post("/chaos/event-publish")
def publish_chaos_event(event: dict):
    """Publish custom chaos event to Kafka"""
    publish_event('chaos.injected', event)
    return {
        "message": "Chaos event published",
        "event": event
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8004))
    uvicorn.run(app, host="0.0.0.0", port=port)
