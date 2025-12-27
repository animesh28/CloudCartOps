package main

import (
	"sync"
	"time"
)

// Metrics represents all order service metrics
type Metrics struct {
	StartTime          time.Time
	TotalRequests      int64
	SuccessfulRequests int64
	FailedRequests     int64
	TotalLatency       int64 // milliseconds
	RequestLatencies   []int64
	DatabaseLatencies  []int64
	KafkaLatencies     []int64
	ActiveConnections  int64
	OrdersCreated      int64
	OrdersCancelled    int64
	OrdersCompleted    int64
	StockRestored      int64
	CacheHits          int64
	CacheMisses        int64
	mu                 sync.RWMutex
}

var metricsInstance *Metrics = &Metrics{
	StartTime:        time.Now(),
	RequestLatencies: make([]int64, 0),
	DatabaseLatencies: make([]int64, 0),
	KafkaLatencies:   make([]int64, 0),
}

// RecordRequest records HTTP request metrics
func (m *Metrics) RecordRequest(statusCode int, latencyMs int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.TotalRequests++
	m.TotalLatency += latencyMs
	m.RequestLatencies = append(m.RequestLatencies, latencyMs)
	
	if statusCode >= 400 {
		m.FailedRequests++
	} else {
		m.SuccessfulRequests++
	}
	
	// Keep only last 1000 records
	if len(m.RequestLatencies) > 1000 {
		m.RequestLatencies = m.RequestLatencies[1:]
	}
}

// RecordDatabaseLatency records database operation latency
func (m *Metrics) RecordDatabaseLatency(latencyMs int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.DatabaseLatencies = append(m.DatabaseLatencies, latencyMs)
	if len(m.DatabaseLatencies) > 1000 {
		m.DatabaseLatencies = m.DatabaseLatencies[1:]
	}
}

// RecordKafkaLatency records Kafka operation latency
func (m *Metrics) RecordKafkaLatency(latencyMs int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.KafkaLatencies = append(m.KafkaLatencies, latencyMs)
	if len(m.KafkaLatencies) > 1000 {
		m.KafkaLatencies = m.KafkaLatencies[1:]
	}
}

// RecordOrderCreated increments order creation count
func (m *Metrics) RecordOrderCreated() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OrdersCreated++
}

// RecordOrderCancelled increments order cancellation count
func (m *Metrics) RecordOrderCancelled() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OrdersCancelled++
}

// RecordOrderCompleted increments order completion count
func (m *Metrics) RecordOrderCompleted() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OrdersCompleted++
}

// RecordStockRestored increments stock restoration count
func (m *Metrics) RecordStockRestored() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.StockRestored++
}

// RecordCacheHit increments cache hit count
func (m *Metrics) RecordCacheHit() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.CacheHits++
}

// RecordCacheMiss increments cache miss count
func (m *Metrics) RecordCacheMiss() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.CacheMisses++
}

// GetAverageLatency returns average request latency in ms
func (m *Metrics) GetAverageLatency() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if m.TotalRequests == 0 {
		return 0
	}
	return float64(m.TotalLatency) / float64(m.TotalRequests)
}

// GetAverageDatabaseLatency returns average database latency in ms
func (m *Metrics) GetAverageDatabaseLatency() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if len(m.DatabaseLatencies) == 0 {
		return 0
	}
	
	total := int64(0)
	for _, latency := range m.DatabaseLatencies {
		total += latency
	}
	return float64(total) / float64(len(m.DatabaseLatencies))
}

// GetAverageKafkaLatency returns average Kafka latency in ms
func (m *Metrics) GetAverageKafkaLatency() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if len(m.KafkaLatencies) == 0 {
		return 0
	}
	
	total := int64(0)
	for _, latency := range m.KafkaLatencies {
		total += latency
	}
	return float64(total) / float64(len(m.KafkaLatencies))
}

// GetErrorRate returns error percentage
func (m *Metrics) GetErrorRate() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if m.TotalRequests == 0 {
		return 0
	}
	return float64(m.FailedRequests) / float64(m.TotalRequests) * 100
}

// GetP95Latency returns 95th percentile latency
func (m *Metrics) GetP95Latency() int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if len(m.RequestLatencies) < 20 {
		return 0
	}
	
	// Simple percentile: 95% of sorted array
	index := (len(m.RequestLatencies) * 95) / 100
	return m.RequestLatencies[index]
}

// GetCacheHitRate returns cache hit percentage
func (m *Metrics) GetCacheHitRate() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	total := m.CacheHits + m.CacheMisses
	if total == 0 {
		return 0
	}
	return float64(m.CacheHits) / float64(total) * 100
}

// GetSnapshot returns current metrics snapshot
func (m *Metrics) GetSnapshot() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	uptime := time.Since(m.StartTime).Seconds()
	requestRate := float64(m.TotalRequests) / uptime
	
	return map[string]interface{}{
		"service": "order-service",
		"uptime_seconds": uptime,
		"total_requests": m.TotalRequests,
		"successful_requests": m.SuccessfulRequests,
		"failed_requests": m.FailedRequests,
		"error_rate_percent": m.GetErrorRate(),
		"request_rate_per_sec": requestRate,
		"average_latency_ms": m.GetAverageLatency(),
		"p95_latency_ms": m.GetP95Latency(),
		"database_avg_latency_ms": m.GetAverageDatabaseLatency(),
		"kafka_avg_latency_ms": m.GetAverageKafkaLatency(),
		"orders_created": m.OrdersCreated,
		"orders_cancelled": m.OrdersCancelled,
		"orders_completed": m.OrdersCompleted,
		"stock_restored_count": m.StockRestored,
		"cache_hit_rate_percent": m.GetCacheHitRate(),
		"cache_hits": m.CacheHits,
		"cache_misses": m.CacheMisses,
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetMetrics returns global metrics instance
func GetMetrics() *Metrics {
	return metricsInstance
}
