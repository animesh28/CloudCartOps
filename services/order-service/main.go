package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
)

var db *sql.DB

type Order struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	TotalAmount float64   `json:"total_amount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Items       []OrderItem `json:"items,omitempty"`
}

type OrderItem struct {
	ID        int     `json:"id"`
	OrderID   int     `json:"order_id"`
	ProductID int     `json:"product_id"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateOrderRequest struct {
	UserID int         `json:"user_id"`
	Items  []OrderItem `json:"items"`
}

func main() {
	godotenv.Load()

	// Database connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://cloudcart:cloudcart123@postgres:5432/cloudcart?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	log.Println("Connected to database")

	// Initialize Kafka
	initKafka()

	// Router
	r := mux.NewRouter()

	r.HandleFunc("/health", healthCheck).Methods("GET")
	r.HandleFunc("/orders", getAllOrders).Methods("GET")
	r.HandleFunc("/orders", createOrder).Methods("POST")
	r.HandleFunc("/orders/{id}", getOrder).Methods("GET")
	r.HandleFunc("/orders/user/{user_id}", getUserOrders).Methods("GET")
	r.HandleFunc("/orders/{id}/status", updateOrderStatus).Methods("PATCH")
	r.HandleFunc("/orders/{id}/pay", processPayment).Methods("POST")

	// CORS
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}).Handler(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}

	log.Printf("Order Service running on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"service":   "order-service",
		"timestamp": time.Now().Format(time.RFC3339),
	}
	json.NewEncoder(w).Encode(response)
}

func createOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.Items) == 0 {
		http.Error(w, "Order must contain at least one item", http.StatusBadRequest)
		return
	}

	// Calculate total
	var totalAmount float64
	for _, item := range req.Items {
		totalAmount += item.Price * float64(item.Quantity)
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Insert order with "awaiting_payment" status
	var orderID int
	err = tx.QueryRow(
		"INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id",
		req.UserID, totalAmount, "awaiting_payment",
	).Scan(&orderID)

	if err != nil {
		log.Println("Failed to create order:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert order items
	for _, item := range req.Items {
		_, err = tx.Exec(
			"INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
			orderID, item.ProductID, item.Quantity, item.Price,
		)
		if err != nil {
			log.Println("Failed to create order item:", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Publish event to Kafka
	publishOrderEvent("order.created", map[string]interface{}{
		"order_id":     orderID,
		"user_id":      req.UserID,
		"total_amount": totalAmount,
		"status":       "awaiting_payment",
		"items":        len(req.Items),
		"timestamp":    time.Now().Format(time.RFC3339),
	})

	// Get created order
	order, err := getOrderByID(orderID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

func getOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	order, err := getOrderByID(orderID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Order not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func getAllOrders(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, user_id, total_amount, status, created_at, updated_at 
		FROM orders 
		ORDER BY created_at DESC
	`)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		err := rows.Scan(&order.ID, &order.UserID, &order.TotalAmount, &order.Status, &order.CreatedAt, &order.UpdatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		orders = append(orders, order)
	}

	if orders == nil {
		orders = []Order{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func getUserOrders(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	rows, err := db.Query(`
		SELECT id, user_id, total_amount, status, created_at, updated_at 
		FROM orders 
		WHERE user_id = $1 
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		err := rows.Scan(&order.ID, &order.UserID, &order.TotalAmount, &order.Status, &order.CreatedAt, &order.UpdatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		orders = append(orders, order)
	}

	if orders == nil {
		orders = []Order{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func updateOrderStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get current order to validate status transition
	order, err := getOrderByID(orderID)
	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Validate status transitions
	if !isValidStatusTransition(order.Status, req.Status) {
		http.Error(w, fmt.Sprintf("Cannot transition from %s to %s", order.Status, req.Status), http.StatusBadRequest)
		return
	}

	// Update order status
	_, err = db.Exec(
		"UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2",
		req.Status, orderID,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Restore stock based on status transitions
	restoreStockNeeded := false
	restoreReason := ""

	if req.Status == "cancelled" && order.Status == "confirmed" {
		restoreStockNeeded = true
		restoreReason = "order cancellation"
	} else if req.Status == "returned" && order.Status == "delivered" {
		restoreStockNeeded = true
		restoreReason = "order return"
	}

	if restoreStockNeeded {
		for _, item := range order.Items {
			_, err := http.Post(
				"http://product-service:8002/products/"+strconv.Itoa(item.ProductID)+"/stock/restore",
				"application/json",
				bytes.NewBuffer([]byte(fmt.Sprintf(`{"quantity": %d}`, item.Quantity))),
			)
			if err != nil {
				log.Printf("Warning: Failed to restore stock for product %d (%s): %v", item.ProductID, restoreReason, err)
			}
		}
	}

	// Publish event for status change with detailed information
	eventMessage := map[string]interface{}{
		"order_id":        orderID,
		"user_id":         order.UserID,
		"old_status":      order.Status,
		"new_status":      req.Status,
		"total_amount":    order.TotalAmount,
		"item_count":      len(order.Items),
		"timestamp":       time.Now().Format(time.RFC3339),
	}
	
	// Include status-specific details
	switch req.Status {
	case "shipped":
		eventMessage["message"] = "Order has been shipped and is on its way"
	case "delivered":
		eventMessage["message"] = "Order has been delivered to customer"
	case "cancelled":
		if order.Status == "confirmed" {
			eventMessage["message"] = "Order has been cancelled and stock has been restored"
		} else {
			eventMessage["message"] = "Order has been cancelled"
		}
	case "returned":
		if order.Status == "delivered" {
			eventMessage["message"] = "Order has been returned by customer and stock has been restored"
		} else {
			eventMessage["message"] = "Order has been returned"
		}
	default:
		eventMessage["message"] = "Order status updated"
	}

	publishOrderEvent("order.status_changed", eventMessage)

	// Get updated order
	updatedOrder, err := getOrderByID(orderID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedOrder)
}

func processPayment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	var req struct {
		PaymentMethod string `json:"payment_method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get current order
	order, err := getOrderByID(orderID)
	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Only process payment for orders awaiting payment
	if order.Status != "awaiting_payment" {
		http.Error(w, "Order is not awaiting payment", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update order status to "confirmed"
	_, err = tx.Exec(
		"UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2",
		"confirmed", orderID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Reduce stock for all items in the order
	for _, item := range order.Items {
		err := reduceProductStockTx(tx, item.ProductID, item.Quantity)
		if err != nil {
			log.Printf("Warning: Failed to reduce stock for product %d: %v", item.ProductID, err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Publish payment success event
	publishOrderEvent("order.payment_confirmed", map[string]interface{}{
		"order_id":        orderID,
		"user_id":         order.UserID,
		"total_amount":    order.TotalAmount,
		"payment_method":  req.PaymentMethod,
		"item_count":      len(order.Items),
		"timestamp":       time.Now().Format(time.RFC3339),
		"message":         "Payment successful - Order confirmed and ready for shipment",
	})

	// Also publish status change event (awaiting_payment -> confirmed)
	publishOrderEvent("order.status_changed", map[string]interface{}{
		"order_id":        orderID,
		"user_id":         order.UserID,
		"old_status":      "awaiting_payment",
		"new_status":      "confirmed",
		"total_amount":    order.TotalAmount,
		"item_count":      len(order.Items),
		"timestamp":       time.Now().Format(time.RFC3339),
		"message":         "Order confirmed - Payment received, stock reduced",
	})

	// Get updated order
	updatedOrder, err := getOrderByID(orderID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedOrder)
}

func reduceProductStock(productID int, quantity int) error {
	// Call product service to reduce stock
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Get the product service URL from environment or use default
	productServiceURL := os.Getenv("PRODUCT_SERVICE_URL")
	if productServiceURL == "" {
		productServiceURL = "http://product-service:8002"
	}

	// Get current stock
	resp, err := client.Get(productServiceURL + "/products/" + strconv.Itoa(productID))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var product map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&product); err != nil {
		return err
	}

	// Calculate new stock
	currentStock := int(product["stock"].(float64))
	newStock := currentStock - quantity
	if newStock < 0 {
		newStock = 0
	}

	// Update stock in product service
	updateReq, err := http.NewRequest(
		"PATCH",
		productServiceURL+"/products/"+strconv.Itoa(productID)+"/stock",
		nil,
	)
	if err != nil {
		return err
	}

	// Send JSON body
	body := map[string]int{"stock": newStock}
	bodyBytes, _ := json.Marshal(body)
	updateReq.Body = getReadCloser(bodyBytes)
	updateReq.Header.Set("Content-Type", "application/json")

	respUpdate, err := client.Do(updateReq)
	if err != nil {
		return err
	}
	defer respUpdate.Body.Close()

	if respUpdate.StatusCode != http.StatusOK && respUpdate.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to update stock: status %d", respUpdate.StatusCode)
	}

	return nil
}

func reduceProductStockTx(tx *sql.Tx, productID int, quantity int) error {
	// This version uses HTTP to call product service (external service)
	// In a real distributed system, you'd use this approach
	return reduceProductStock(productID, quantity)
}

func isValidStatusTransition(currentStatus, newStatus string) bool {
	// Define valid status transitions
	validTransitions := map[string][]string{
		"awaiting_payment": {"confirmed", "cancelled"},
		"confirmed":        {"shipped", "cancelled"},
		"shipped":          {"delivered", "returned"},
		"delivered":        {"returned"},
		"cancelled":        {},
		"returned":         {},
	}

	validStatuses, exists := validTransitions[currentStatus]
	if !exists {
		return false
	}

	for _, status := range validStatuses {
		if status == newStatus {
			return true
		}
	}
	return false
}

func getReadCloser(data []byte) io.ReadCloser {
	return io.NopCloser(bytes.NewReader(data))
}

func getOrderByID(orderID int) (*Order, error) {
	var order Order
	err := db.QueryRow(`
		SELECT id, user_id, total_amount, status, created_at, updated_at 
		FROM orders 
		WHERE id = $1
	`, orderID).Scan(&order.ID, &order.UserID, &order.TotalAmount, &order.Status, &order.CreatedAt, &order.UpdatedAt)

	if err != nil {
		return nil, err
	}

	// Get order items
	rows, err := db.Query(`
		SELECT id, order_id, product_id, quantity, price, created_at 
		FROM order_items 
		WHERE order_id = $1
	`, orderID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item OrderItem
		err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.Quantity, &item.Price, &item.CreatedAt)
		if err != nil {
			return nil, err
		}
		order.Items = append(order.Items, item)
	}

	return &order, nil
}
