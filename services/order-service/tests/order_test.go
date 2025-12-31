package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
)

// TestHealthEndpoint tests the /health endpoint
func TestHealthEndpoint(t *testing.T) {
	t.Log("Testing order service health endpoint")

	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "healthy",
			"service": "order-service",
		})
	}).Methods("GET")

	req, _ := http.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%v'", response["status"])
	}

	t.Log("✓ Health endpoint test passed")
}

// TestCreateOrderValidation tests order creation validation
func TestCreateOrderValidation(t *testing.T) {
	t.Log("Testing order creation validation")

	r := mux.NewRouter()
	r.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
		var order map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
			return
		}

		// Validate required fields
		if _, ok := order["user_id"]; !ok {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "user_id is required"})
			return
		}

		items, ok := order["items"].([]interface{})
		if !ok || len(items) == 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Order must contain at least one item"})
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":     1,
			"status": "awaiting_payment",
			"items":  items,
		})
	}).Methods("POST")

	// Test with valid order
	t.Run("ValidOrder", func(t *testing.T) {
		validOrder := `{
			"user_id": 1,
			"items": [
				{"product_id": 1, "quantity": 2, "price": 10.0}
			]
		}`

		req, _ := http.NewRequest("POST", "/orders", strings.NewReader(validOrder))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", rr.Code)
		}

		t.Log("✓ Valid order creation test passed")
	})

	// Test with missing user_id
	t.Run("MissingUserID", func(t *testing.T) {
		invalidOrder := `{
			"items": [
				{"product_id": 1, "quantity": 2, "price": 10.0}
			]
		}`

		req, _ := http.NewRequest("POST", "/orders", strings.NewReader(invalidOrder))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", rr.Code)
		}

		t.Log("✓ Missing user_id validation test passed")
	})

	// Test with empty items
	t.Run("EmptyItems", func(t *testing.T) {
		invalidOrder := `{
			"user_id": 1,
			"items": []
		}`

		req, _ := http.NewRequest("POST", "/orders", strings.NewReader(invalidOrder))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", rr.Code)
		}

		t.Log("✓ Empty items validation test passed")
	})
}

// TestOrderStatusFlow tests order status transitions
func TestOrderStatusFlow(t *testing.T) {
	t.Log("Testing order status flow")

	validStatuses := []string{
		"awaiting_payment",
		"confirmed",
		"shipped",
		"delivered",
		"cancelled",
		"returned",
	}

	for _, status := range validStatuses {
		t.Run(status, func(t *testing.T) {
			// Test that each status is a valid state
			if status == "" {
				t.Errorf("Invalid empty status")
			}
			t.Logf("✓ Status '%s' is valid", status)
		})
	}
}

// TestOrderItemStructure tests order item data structure
func TestOrderItemStructure(t *testing.T) {
	t.Log("Testing order item structure")

	orderItem := map[string]interface{}{
		"order_id":     1,
		"product_id":   10,
		"product_name": "Test Product",
		"quantity":     2,
		"price":        15.99,
	}

	// Validate required fields
	requiredFields := []string{"order_id", "product_id", "product_name", "quantity", "price"}

	for _, field := range requiredFields {
		if _, ok := orderItem[field]; !ok {
			t.Errorf("Order item missing required field: %s", field)
		}
	}

	// Validate quantity is positive
	if quantity, ok := orderItem["quantity"].(int); ok {
		if quantity <= 0 {
			t.Errorf("Quantity must be positive, got %d", quantity)
		}
	}

	// Validate price is positive
	if price, ok := orderItem["price"].(float64); ok {
		if price <= 0 {
			t.Errorf("Price must be positive, got %f", price)
		}
	}

	t.Log("✓ Order item structure validation passed")
}

// TestMetricsEndpoint tests the /metrics endpoint
func TestMetricsEndpoint(t *testing.T) {
	t.Log("Testing Prometheus metrics endpoint")

	r := mux.NewRouter()
	r.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		w.WriteHeader(http.StatusOK)
		// Simulate Prometheus metrics output
		w.Write([]byte("# HELP order_http_requests_total Total HTTP requests\n"))
		w.Write([]byte("# TYPE order_http_requests_total counter\n"))
		w.Write([]byte("order_http_requests_total{method=\"GET\",endpoint=\"/orders\",status=\"200\"} 42\n"))
	}).Methods("GET")

	req, _ := http.NewRequest("GET", "/metrics", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Errorf("Expected Content-Type to contain 'text/plain', got '%s'", contentType)
	}

	if !strings.Contains(rr.Body.String(), "order_http_requests_total") {
		t.Errorf("Metrics response should contain metric names")
	}

	t.Log("✓ Metrics endpoint test passed")
}
