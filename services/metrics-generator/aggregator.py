"""
Metrics Aggregator Service
Collects metrics from all services and provides centralized monitoring
"""
import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Any
import threading


class MetricsAggregator:
    """Aggregate metrics from all CloudCart services"""
    
    def __init__(self):
        self.services = {
            'api-gateway': 'http://api-gateway:3000/metrics',
            'order-service': 'http://order-service:8003/metrics',
            'user-service': 'http://user-service:8001/metrics',
            'product-service': 'http://product-service:8002/metrics',
            'chaos-service': 'http://chaos-service:8004/metrics',
            'notification-worker': 'http://notification-worker:8005/metrics'
        }
        self.metrics_history = {}
        self.last_update = None
    
    def collect_service_metrics(self, service_name: str, url: str) -> Dict[str, Any]:
        """Collect metrics from a single service"""
        try:
            response = requests.get(url, timeout=2)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {
                'service': service_name,
                'error': str(e),
                'status': 'unavailable',
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def collect_all_metrics(self) -> Dict[str, Any]:
        """Collect metrics from all services"""
        all_metrics = {}
        
        for service_name, url in self.services.items():
            all_metrics[service_name] = self.collect_service_metrics(service_name, url)
        
        self.last_update = datetime.utcnow().isoformat()
        self.metrics_history[self.last_update] = all_metrics
        
        # Keep only last 100 updates
        if len(self.metrics_history) > 100:
            oldest_key = min(self.metrics_history.keys())
            del self.metrics_history[oldest_key]
        
        return all_metrics
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        metrics = self.collect_all_metrics()
        
        healthy_services = 0
        unhealthy_services = 0
        error_rate_avg = 0
        latency_avg = 0
        service_count = 0
        
        for service_name, service_metrics in metrics.items():
            if 'error' in service_metrics:
                unhealthy_services += 1
            else:
                healthy_services += 1
                service_count += 1
                error_rate_avg += service_metrics.get('error_rate_percent', 0)
                latency_avg += service_metrics.get('average_latency_ms', 0)
        
        if service_count > 0:
            error_rate_avg /= service_count
            latency_avg /= service_count
        
        health_status = 'healthy' if unhealthy_services == 0 else 'degraded'
        
        return {
            'status': health_status,
            'healthy_services': healthy_services,
            'unhealthy_services': unhealthy_services,
            'total_services': len(self.services),
            'average_error_rate': error_rate_avg,
            'average_latency_ms': latency_avg,
            'services': metrics,
            'last_update': self.last_update
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get aggregated performance metrics"""
        metrics = self.collect_all_metrics()
        
        total_requests = 0
        total_errors = 0
        latencies = []
        
        for service_name, service_metrics in metrics.items():
            if 'error' not in service_metrics:
                total_requests += service_metrics.get('total_requests', 0)
                total_errors += service_metrics.get('failed_requests', 0)
                latencies.append(service_metrics.get('average_latency_ms', 0))
        
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        
        return {
            'total_requests': total_requests,
            'total_errors': total_errors,
            'error_rate': error_rate,
            'average_latency_ms': avg_latency,
            'p95_latency': max([m.get('p95_latency_ms', 0) for m in metrics.values() if 'error' not in m], default=0),
            'p99_latency': max([m.get('p99_latency_ms', 0) for m in metrics.values() if 'error' not in m], default=0),
            'timestamp': self.last_update
        }
    
    def get_service_dependencies(self) -> Dict[str, List[str]]:
        """Get service dependency graph"""
        return {
            'api-gateway': ['user-service', 'order-service', 'product-service', 'chaos-service'],
            'order-service': ['product-service'],
            'user-service': [],
            'product-service': [],
            'chaos-service': [],
            'notification-worker': []
        }
    
    def get_alerts(self) -> List[Dict[str, Any]]:
        """Generate alerts based on current metrics"""
        metrics = self.collect_all_metrics()
        alerts = []
        
        for service_name, service_metrics in metrics.items():
            if 'error' in service_metrics:
                alerts.append({
                    'severity': 'critical',
                    'service': service_name,
                    'message': f'{service_name} is unavailable',
                    'timestamp': datetime.utcnow().isoformat()
                })
            else:
                error_rate = service_metrics.get('error_rate_percent', 0)
                if error_rate > 10:
                    alerts.append({
                        'severity': 'warning',
                        'service': service_name,
                        'message': f'High error rate: {error_rate:.2f}%',
                        'timestamp': datetime.utcnow().isoformat()
                    })
                
                latency = service_metrics.get('average_latency_ms', 0)
                if latency > 1000:
                    alerts.append({
                        'severity': 'warning',
                        'service': service_name,
                        'message': f'High latency: {latency:.0f}ms',
                        'timestamp': datetime.utcnow().isoformat()
                    })
        
        return alerts
    
    def export_prometheus_format(self) -> str:
        """Export metrics in Prometheus format"""
        metrics = self.collect_all_metrics()
        lines = []
        
        for service_name, service_metrics in metrics.items():
            if 'error' not in service_metrics:
                labels = f'service="{service_name}"'
                lines.append(f'service_uptime_seconds{{{labels}}} {service_metrics.get("uptime_seconds", 0)}')
                lines.append(f'service_requests_total{{{labels}}} {service_metrics.get("total_requests", 0)}')
                lines.append(f'service_errors_total{{{labels}}} {service_metrics.get("failed_requests", 0)}')
                lines.append(f'service_error_rate_percent{{{labels}}} {service_metrics.get("error_rate_percent", 0)}')
                lines.append(f'service_latency_ms{{{labels}}} {service_metrics.get("average_latency_ms", 0)}')
                lines.append(f'service_p95_latency_ms{{{labels}}} {service_metrics.get("p95_latency_ms", 0)}')
        
        return '\n'.join(lines)


# Global aggregator instance
_aggregator = MetricsAggregator()


def get_aggregator() -> MetricsAggregator:
    """Get global metrics aggregator instance"""
    return _aggregator
